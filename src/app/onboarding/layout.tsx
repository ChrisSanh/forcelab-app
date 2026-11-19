// Authenticated segment: it reads the session, so navigation into it may block.
export const instant = false;

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
