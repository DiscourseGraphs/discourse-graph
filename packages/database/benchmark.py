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
        f"select upsert_accounts_in_space({space_id}, '{dumps(accounts)}')",
        debug=False,
    )
    nums = [int(i) for i in result.split()]
    accounts = {i: d | dict(id=i) for (i, d) in zip(nums, accounts)}
    print("Accounts:", ", ".join(str(a) for a in accounts.keys()))
    return accounts


def generate_concept_nodes(url, space_id, accounts, node_specs):
    account_ids = list(accounts.keys())
    num_accounts = len(account_ids)
    now = datetime.now().isoformat()
    random_account = lambda: account_ids[randint(0, num_accounts - 1)]

    schema_content = [
        dict(
            text=schema["name"],
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=random_account(),
            source_local_id=schema["name"],
            document_inline=dict(
                source_local_id=schema["name"],
                created=now,
                last_modified=now,
                space_id=space_id,
                author_id=random_account(),
            ),
        )
        for schema in node_specs
    ]
    result = psql_command(
        url,
        f"select upsert_content({space_id}, '{dumps(schema_content)}', null);",
    )
    nums = [int(i) for i in result.split()]
    schema_content = {d["text"]: d | dict(id=i) for (i, d) in zip(nums, schema_content)}

    schema_nodes = [
        dict(
            name=schema["name"],
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=random_account(),
            represented_by_id=schema_content[schema["name"]]["id"],
            is_schema=True,
        )
        for schema in node_specs
    ]
    result = psql_command(
        url,
        f"select upsert_concepts({space_id}, '{dumps(schema_nodes)}');",
    )
    nums = [int(i) for i in result.split()]
    schema_nodes = {d["name"]: d | dict(id=i) for (i, d) in zip(nums, schema_nodes)}
    print("Schema nodes", ", ".join(f"{k}: {v['id']}" for k, v in schema_nodes.items()))
    all_nodes = {}
    for schema in node_specs:
        target_num = schema["count"]
        schema_id = schema_nodes[schema["name"]]["id"]
        for b in range(0, target_num, 500):
            nodes = [
                dict(
                    name=f"{schema['name']}_{i}",
                    created=now,
                    last_modified=now,
                    space_id=space_id,
                    author_id=random_account(),
                    schema_id=schema_id,
                )
                for i in range(b, min(b + 500, target_num))
            ]
            result = psql_command(
                url, f"select upsert_concepts({space_id}, '{dumps(nodes)}');"
            )
            nums = [int(i) for i in result.split()]
            all_nodes |= {i: d | dict(id=i) for (i, d) in zip(nums, nodes)}
    print("Nodes:", ", ".join(str(a) for a in all_nodes.keys()))
    return schema_nodes, all_nodes


def generate_relations(url, space_id, accounts, schema_nodes, nodes, relation_specs):
    account_ids = list(accounts.keys())
    num_accounts = len(account_ids)
    now = datetime.now().isoformat()
    random_account = lambda: account_ids[randint(0, num_accounts - 1)]
    node_ids_by_type = defaultdict(list)
    schema_name_by_id = {s["id"]: s["name"] for s in schema_nodes.values()}
    for id, node in nodes.items():
        node_ids_by_type[schema_name_by_id[node["schema_id"]]].append(id)

    def random_node(schema_name):
        if isinstance(schema_name, list):
            schema_name = schema_name[randint(0, len(schema_name) - 1)]
        node_ids = node_ids_by_type[schema_name]
        return node_ids[randint(0, len(node_ids) - 1)]

    schema_content = [
        dict(
            text=schema["name"],
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=random_account(),
            source_local_id=schema["name"],
            document_inline=dict(
                source_local_id=schema["name"],
                created=now,
                last_modified=now,
                space_id=space_id,
                author_id=random_account(),
            ),
        )
        for schema in relation_specs
    ]
    result = psql_command(
        url,
        f"select upsert_content({space_id}, '{dumps(schema_content)}', null);",
    )
    nums = [int(i) for i in result.split()]
    schema_content = {d["text"]: d | dict(id=i) for (i, d) in zip(nums, schema_content)}

    schema_nodes = [
        dict(
            name=schema["name"],
            created=now,
            last_modified=now,
            space_id=space_id,
            author_id=random_account(),
            literal_content=dict(roles=["source", "destination"]),
            represented_by_id=schema_content[schema["name"]]["id"],
            is_schema=True,
        )
        for schema in relation_specs
    ]
    result = psql_command(
        url,
        f"select upsert_concepts({space_id}, '{dumps(schema_nodes)}');",
    )
    nums = [int(i) for i in result.split()]
    schema_nodes = {d["name"]: d | dict(id=i) for (i, d) in zip(nums, schema_nodes)}
    print(
        "Schema relations:",
        ", ".join(f"{k}: {v['id']}" for k, v in schema_nodes.items()),
    )
    all_nodes = {}
    for schema in relation_specs:
        target_num = schema["count"]
        schema_id = schema_nodes[schema["name"]]["id"]
        roles = schema["roles"]
        for b in range(0, target_num, 500):
            nodes = [
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
                f"select upsert_concepts({space_id}, '{dumps(nodes)}');",
            )
            nums = [int(i) for i in result.split()]
            all_nodes |= {i: d | dict(id=i) for (i, d) in zip(nums, nodes)}
    print("Relations:", ", ".join(str(a) for a in all_nodes.keys()))
    return schema_nodes, all_nodes


def main(fname):
    with open(fname) as f:
        params = safe_load(f)
    url: Url = parse_url(params["database_url"])
    init_database(url, params.get("schemas", []))
    space_id = generate_space(url)
    accounts = generate_accounts(url, params["accounts"]["count"], space_id)
    node_schemas, nodes = generate_concept_nodes(
        url, space_id, accounts, params["nodes"]
    )
    reln_schemas, relations = generate_relations(
        url, space_id, accounts, node_schemas, nodes, params["relations"]
    )


if __name__ == "__main__":
    fname = sys.argv[-1]
    main(fname)
