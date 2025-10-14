#!/usr/bin/env python3
import sys
from collections import defaultdict
from datetime import datetime
from json import dumps
from random import randint
from subprocess import run

from urllib3.util.url import Url, parse_url
from yaml import safe_load


def as_bool(value):
    if type(value) is bool:
        return value
    return str(value).lower() in {"true", "yes", "on", "1", "checked"}


def psql_command(url: Url, command, cmdfile=None, debug=False, sudo=False, db=None):
    if debug:
        print(command)
    assert ":" in url.auth, "Please provide the password in the postgres URL."
    user, password = url.auth.split(":", 1)
    host = url.hostname
    port = url.port
    db = db or url.path.strip("/")

    assert not (sudo and password)
    if password:
        conn = ["psql", f"postgresql://{user}:{password}@{host}:{port}/{db}"]
    else:
        if sudo:
            conn = ["sudo", "-u", user, "psql"]
        else:
            conn = ["psql", "-U", user]
        conn.append(db)
        if not sudo and host != "localhost":
            conn.extend(["-h", host])
    conn.extend(["-q", "--csv", "-t", "-n"])
    if port != 5432:
        conn.extend(["-p", str(port)])
    if command:
        conn.extend(["-c", command])
    if cmdfile:
        conn.extend(["-f", cmdfile])
    r = run(conn, capture_output=True, encoding="utf-8")
    if debug:
        print(r.returncode, r.stdout, r.stderr)
    assert not r.returncode
    assert "ERROR" not in r.stderr, r.stderr
    return r.stdout


def init_database(url, schemas):
    db = url.path.strip("/")
    if schemas:
        # This is intended for a local postgres, not for a local supabase.
        psql_command(url, f"drop database if exists {db};", db="postgres")
        psql_command(url, f"create database {db};", db="postgres")
        for schema in schemas:
            psql_command(url, None, schema)
    else:
        # Clear data
        psql_command(url, 'truncate "Concept" CASCADE')
        # psql_command(url, 'truncate "Content" CASCADE')
        # psql_command(url, 'truncate "Document" CASCADE')
        # psql_command(url, 'truncate "AgentIdentifier" CASCADE')
        psql_command(url, 'truncate "PlatformAccount" CASCADE')
        psql_command(url, 'truncate "Space" CASCADE')


def generate_space(url):
    result = psql_command(
        url,
        """insert into public."Space" (url, name, platform) values ('test', 'test', 'Roam') RETURNING id; """,
    )
    print("Space:", result)
    return int(result)


def generate_accounts(url, num_accounts, space_id):
    accounts = [
        dict(account_local_id=f"account_{i}", name=f"account_{i}")
        for i in range(num_accounts)
    ]
    result = psql_command(
        url,
        f"select upsert_accounts_in_space({space_id}, $json${dumps(accounts)}$json$)",
        debug=False,
    )
    nums = [int(i) for i in result.split()]
    accounts = {i: d | dict(id=i) for (i, d) in zip(nums, accounts)}
    print("Accounts:", ", ".join(str(a) for a in accounts.keys()))
    return accounts


def generate_content(
    url, space_id, accounts, target_num: int, names=None, prefix="content"
):
    account_ids = list(accounts.keys())
    num_accounts = len(account_ids)
    now = datetime.now().isoformat()
    inames = iter(names) if names else (f"{prefix}_{i}" for i in range(target_num))

    def make_content():
        account_id = account_ids[randint(0, num_accounts - 1)]
        page_local_id = next(inames)
        return dict(
            text=page_local_id,
            source_local_id=page_local_id,
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=account_id,
            document_inline=dict(
                source_local_id=page_local_id,
                created=now,
                last_modified=now,
                author_id=account_id,
            ),
        )

    all_content = []
    for b in range(0, target_num, 500):
        content = [make_content() for i in range(b, min(b + 500, target_num))]
        result = psql_command(
            url,
            f"select upsert_content({space_id}, $json${dumps(content)}$json$, null);",
        )
        for i, n in enumerate(result.split()):
            content[i]["id"] = int(n)
        all_content.extend(content)
    print("Content:", ", ".join(str(c["id"]) for c in all_content))
    return all_content


def generate_concept_schemata(url, space_id, accounts, node_specs, relation_specs):
    now = datetime.now().isoformat()
    all_specs = node_specs + relation_specs
    content_list = generate_content(
        url, space_id, accounts, len(all_specs), names=[s["name"] for s in all_specs]
    )
    content_iter = iter(content_list)

    def make_concept_schema(name, content, is_relation):
        return dict(
            name=name,
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=content["author_id"],
            represented_by_id=content["id"],
            is_schema=True,
            literal_content=dict(roles=["source", "target"]) if is_relation else dict(),
        )

    node_schemas = [
        make_concept_schema(schema["name"], next(content_iter), False)
        for schema in node_specs
    ]
    relation_schemas = [
        make_concept_schema(schema["name"], next(content_iter), True)
        for schema in relation_specs
    ]
    schemata = node_schemas + relation_schemas
    result = psql_command(
        url,
        f"select upsert_concepts({space_id}, $json${dumps(schemata)}$json$);",
    )
    nums = result.split()
    for i, schema in enumerate(schemata):
        schema["id"] = int(nums[i])
    node_schemas_by_name = {s["name"]: s for s in node_schemas}
    relation_schemas_by_name = {s["name"]: s for s in relation_schemas}
    print("Schema nodes", ", ".join(f"{s['name']}: {s['id']}" for s in schemata))
    return node_schemas_by_name, relation_schemas_by_name


def generate_concept_nodes(url, space_id, accounts, node_schemas, node_specs):
    now = datetime.now().isoformat()

    def make_node(name, content, schema_id):
        return dict(
            name=name,
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=content["author_id"],
            represented_by_id=content["id"],
            schema_id=schema_id,
        )

    all_nodes = []
    for schema in node_specs:
        target_num = schema["count"]
        schema_id = node_schemas[schema["name"]]["id"]
        content_list = generate_content(
            url, space_id, accounts, target_num, prefix=schema["name"]
        )
        content_iter = iter(content_list)
        for b in range(0, target_num, 500):
            local_target_num = min(b + 500, target_num)
            nodes = [
                make_node(f"{schema['name']}_{i}", next(content_iter), schema_id)
                for i in range(b, local_target_num)
            ]
            result = psql_command(
                url, f"select upsert_concepts({space_id}, $json${dumps(nodes)}$json$);"
            )
            nums = result.split()
            for i, node in enumerate(nodes):
                node["id"] = int(nums[i])
            all_nodes.extend(nodes)
    print("Nodes:", ", ".join(str(n["id"]) for n in all_nodes))
    return all_nodes


def generate_relations(
    url, space_id, accounts, node_schemas, reln_schemas, nodes, relation_specs
):
    account_ids = list(accounts.keys())
    num_accounts = len(account_ids)
    now = datetime.now().isoformat()

    def random_account():
        return account_ids[randint(0, num_accounts - 1)]

    node_ids_by_type = defaultdict(list)
    schema_name_by_id = {s["id"]: s["name"] for s in node_schemas.values()}
    for node in nodes:
        node_ids_by_type[schema_name_by_id[node["schema_id"]]].append(node["id"])

    def random_node(schema_name):
        if isinstance(schema_name, list):
            schema_name = schema_name[randint(0, len(schema_name) - 1)]
        node_ids = node_ids_by_type[schema_name]
        return node_ids[randint(0, len(node_ids) - 1)]

    all_relns = []
    for schema in relation_specs:
        target_num = schema["count"]
        schema_id = reln_schemas[schema["name"]]["id"]
        roles = schema["roles"]
        for b in range(0, target_num, 500):
            relns = [
                dict(
                    name=f"{schema['name']}_{i}",
                    created=now,
                    last_modified=now,
                    space_id=space_id,
                    author_id=random_account(),
                    reference_content={k: random_node(v) for (k, v) in roles.items()},
                    schema_id=schema_id,
                )
                for i in range(b, min(b + 500, target_num))
            ]
            result = psql_command(
                url,
                f"select upsert_concepts({space_id}, $json${dumps(relns)}$json$);",
            )
            nums = result.split()
            for i, reln in enumerate(relns):
                reln["id"] = int(nums[i])
            all_relns.extend(relns)
    print("Relations:", ", ".join(str(r["id"]) for r in all_relns))
    return all_relns


def main(fname):
    with open(fname) as f:
        params = safe_load(f)
    url: Url = parse_url(params["database_url"])
    init_database(url, params.get("schemas", []))
    space_id = generate_space(url)
    accounts = generate_accounts(url, params["accounts"]["count"], space_id)
    node_schemas_by_name, relation_schemas_by_name = generate_concept_schemata(
        url, space_id, accounts, params["nodes"], params["relations"]
    )
    nodes = generate_concept_nodes(
        url,
        space_id,
        accounts,
        node_schemas_by_name,
        params["nodes"],
    )
    _relations = generate_relations(
        url,
        space_id,
        accounts,
        node_schemas_by_name,
        relation_schemas_by_name,
        nodes,
        params["relations"],
    )


if __name__ == "__main__":
    fname = sys.argv[-1]
    main(fname)
