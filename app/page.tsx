import { AsciiOcean } from "@/components/ascii-ocean";
import { SmoothCursor } from "@/components/smooth-cursor";
import { GitHubIcon, LinkedInIcon } from "@/components/social-icons";

const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/paulo-evangelista/",
    icon: LinkedInIcon,
  },
  {
    label: "GitHub",
    href: "https://github.com/paulo-evangelista",
    icon: GitHubIcon,
  },
] as const;

export default function Home() {
  return (
    <main className="landing">
      <AsciiOcean />

      <nav className="social-links" aria-label="Social links">
        {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
          <a
            className="social-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            key={label}
          >
            <Icon />
          </a>
        ))}
      </nav>

      <SmoothCursor />
    </main>
  );
}
