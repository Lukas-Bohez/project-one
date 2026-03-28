import { FeaturedProjects } from './components/FeaturedProjects';
import PortfolioShell from './components/PortfolioShell';

export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
    >
      <PortfolioShell>
        <FeaturedProjects />
      </PortfolioShell>
    </div>
  );
}
