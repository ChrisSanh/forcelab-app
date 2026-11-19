// Authenticated segment: it reads the session, so navigation into it may block.
export const instant = false;

export default function WorkoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
