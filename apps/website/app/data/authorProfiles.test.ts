import { describe, expect, it } from "vitest";
import {
  AUTHOR_PROFILES,
  getAuthorProfileByName,
  getAuthorProfileBySlug,
} from "./authorProfiles";

describe("author profiles", () => {
  it("publishes only the requested Matt and Joel profiles", () => {
    expect(AUTHOR_PROFILES.map(({ slug }) => slug).sort()).toEqual([
      "joel-chan",
      "matthew-akamatsu",
    ]);
  });

  it("resolves the author names used by existing website content", () => {
    expect(getAuthorProfileByName("Matt Akamatsu")?.slug).toBe(
      "matthew-akamatsu",
    );
    expect(getAuthorProfileByName("Matthew Akamatsu")?.slug).toBe(
      "matthew-akamatsu",
    );
    expect(getAuthorProfileByName("Joel Chan")?.slug).toBe("joel-chan");
    expect(getAuthorProfileByName("Devs")).toBeUndefined();
  });

  it("provides complete linked profile sections", () => {
    for (const profile of AUTHOR_PROFILES) {
      expect(getAuthorProfileBySlug(profile.slug)).toBe(profile);
      expect(profile.affiliations.length).toBeGreaterThan(0);
      expect(profile.publications.length).toBeGreaterThan(0);
      expect(profile.talks.length).toBeGreaterThan(0);

      for (const link of [
        ...profile.publications,
        ...profile.talks,
        ...profile.externalProfiles,
      ]) {
        expect(link.href).toMatch(/^https?:\/\//u);
      }
    }
  });

  it("uses the verified Topos Institute recording title", () => {
    const mattProfile = getAuthorProfileBySlug("matthew-akamatsu");
    const toposTalk = mattProfile?.talks.find(
      ({ href }) =>
        href === "https://www.youtube-nocookie.com/embed/Fm-lzNhVMKs",
    );

    expect(toposTalk?.title).toBe(
      "Collective grassroots knowledge generation with lab discourse graphs",
    );
  });

  it("links Matt's University of Washington profile", () => {
    const mattProfile = getAuthorProfileBySlug("matthew-akamatsu");

    expect(mattProfile?.externalProfiles).toContainEqual({
      href: "https://biology.washington.edu/people/matthew-akamatsu",
      label: "University of Washington Biology profile",
    });
  });
});
