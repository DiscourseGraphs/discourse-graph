import Image from "next/image";
import Link from "next/link";

export interface TeamMember {
  name: string;
  title: string;
  image: string;
  links?: {
    twitter?: string;
    github?: string;
    website?: string;
  };
}

export function TeamPerson({ member }: { member: TeamMember }) {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <div className="relative h-40 w-40 overflow-hidden rounded-full">
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover"
        />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-neutral-dark">
          {member.name}
        </h3>
        <p className="text-neutral-dark/80">{member.title}</p>
      </div>
      {member.links && (
        <div className="flex space-x-4">
          {member.links.twitter && (
            <Link
              href={member.links.twitter}
              className="text-neutral-dark/60 transition-colors hover:text-primary"
              aria-label={`${member.name}'s Twitter`}
            >
              <Image src="/social/x.png" alt="Twitter" width={20} height={20} />
            </Link>
          )}
          {member.links.github && (
            <Link
              href={member.links.github}
              className="text-neutral-dark/60 transition-colors hover:text-primary"
              aria-label={`${member.name}'s GitHub`}
            >
              <Image
                src="/social/github.svg"
                alt="GitHub"
                width={20}
                height={20}
              />
            </Link>
          )}
          {member.links.website && (
            <Link
              href={member.links.website}
              className="text-neutral-dark/60 transition-colors hover:text-primary"
              aria-label={`${member.name}'s Website`}
            >
              <Image
                src="/social/website.png"
                alt="Website"
                width={20}
                height={20}
              />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
