import { getProjects } from '../../lib/queries';
import { ProjectCardList } from './ProjectCardList';
import { Section } from './Section';

type ProjectData = {
  title: string;
  description: string;
  impactLine: string;
  githubUrl: string;
  thumbnail?: unknown;
  slug?: string;
  techTags?: string[];
};

const FALLBACK_PROJECTS = [
  {
    title: 'Convert The Spire Reborn',
    description:
      'The ultimate open-source, ad-free media downloader. Ditch the sketchy, ad-filled online converters. Convert The Spire Reborn is a privacy-first desktop and mobile app that lets you download massive playlists locally and in bulk. Built with a modern yt-dlp bridge, it handles everything without tracking your data or capping your quality.',
    impactLine:
      'Uncompromised Quality: True 4K, 8K, and HDR support. Massive Compatibility: Downloads from 1,800+ sites in mp3, mp4 and m4a. Smart Batch Processing: Download entire offline playlists with local duplicate detection. Tech Stack & License: Flutter, FFmpeg, Offline Media | GNU GPL 3.0',
    githubUrl: 'https://github.com/Lukas-Bohez/ConvertTheSpireFlutter',
    techTags: ['Flutter', 'FFmpeg', 'Offline', 'Media'],
  },
  {
    title: 'QuizTheSpire',
    description:
      'The central hub for the Spire ecosystem. The official web portal and home base for the entire Spire app suite. Dive into a growing, community-driven ecosystem featuring interactive quizzes, stories, browser tools, and leaderboard gaming—all governed by strict privacy policies and open-source principles.',
    impactLine:
      'The Full Suite: Direct, safe downloads for all Spire ecosystem apps. Interactive Content: Hardware-integrated quizzes, games, and community stories. Privacy-First: Zero hidden tracking or telemetry. Tech Stack & License: Web Platform | GNU GPL 3.0',
    githubUrl: 'https://quizthespire.com',
    techTags: ['Web', 'Privacy', 'Community'],
  },
  {
    title: 'Vault The Spire',
    description:
      'Serverless, zero-trust file sharing and messaging. A completely private, peer-to-peer vault built for ultimate security. Vault The Spire operates entirely locally across platforms with no central servers and zero telemetry, ensuring your data stays exclusively in your hands.',
    impactLine:
      'Advanced Encryption: Secured by AES-256-GCM, SQLCipher, and X25519 ratcheting. Decentralized Sharing: Peer-to-peer messaging and file transfers powered by DHT/aria2. Frictionless Setup: Quick, secure onboarding via QR codes. Tech Stack & License: Flutter, Cross-Platform | GNU GPL 3.0',
    githubUrl: 'https://github.com/Lukas-Bohez/vault_the_spire',
    techTags: ['Flutter', 'P2P', 'Encryption'],
  },
];

function normalizeProject(project: ProjectData): ProjectData {
  const base: Record<string, Pick<ProjectData, 'description' | 'impactLine'>> = {
    'Convert The Spire Reborn': {
      description:
        'The ultimate open-source, ad-free media downloader. Ditch the sketchy, ad-filled online converters. Convert The Spire Reborn is a privacy-first desktop and mobile app that lets you download massive playlists locally and in bulk. Built with a modern yt-dlp bridge, it handles everything without tracking your data or capping your quality.',
      impactLine:
        'Uncompromised Quality: True 4K, 8K, and HDR support. Massive Compatibility: Downloads from 1,800+ sites in mp3, mp4 and m4a. Smart Batch Processing: Download entire offline playlists with local duplicate detection. Tech Stack & License: Flutter, FFmpeg, Offline Media | GNU GPL 3.0',
    },
    ConvertTheSpireFlutter: {
      description:
        'The ultimate open-source, ad-free media downloader. Ditch the sketchy, ad-filled online converters. Convert The Spire Reborn is a privacy-first desktop and mobile app that lets you download massive playlists locally and in bulk. Built with a modern yt-dlp bridge, it handles everything without tracking your data or capping your quality.',
      impactLine:
        'Uncompromised Quality: True 4K, 8K, and HDR support. Massive Compatibility: Downloads from 1,800+ sites in mp3, mp4 and m4a. Smart Batch Processing: Download entire offline playlists with local duplicate detection. Tech Stack & License: Flutter, FFmpeg, Offline Media | GNU GPL 3.0',
    },
    QuizTheSpire: {
      description:
        'The central hub for the Spire ecosystem. The official web portal and home base for the entire Spire app suite. Dive into a growing, community-driven ecosystem featuring interactive quizzes, stories, browser tools, and leaderboard gaming—all governed by strict privacy policies and open-source principles.',
      impactLine:
        'The Full Suite: Direct, safe downloads for all Spire ecosystem apps. Interactive Content: Hardware-integrated quizzes, games, and community stories. Privacy-First: Zero hidden tracking or telemetry. Tech Stack & License: Web Platform | GNU GPL 3.0',
    },
    'Vault The Spire': {
      description:
        'Serverless, zero-trust file sharing and messaging. A completely private, peer-to-peer vault built for ultimate security. Vault The Spire operates entirely locally across platforms with no central servers and zero telemetry, ensuring your data stays exclusively in your hands.',
      impactLine:
        'Advanced Encryption: Secured by AES-256-GCM, SQLCipher, and X25519 ratcheting. Decentralized Sharing: Peer-to-peer messaging and file transfers powered by DHT/aria2. Frictionless Setup: Quick, secure onboarding via QR codes. Tech Stack & License: Flutter, Cross-Platform | GNU GPL 3.0',
    },
  };

  if (!project?.title || !base[project.title]) {
    return project;
  }

  return {
    ...project,
    description: base[project.title].description,
    impactLine: base[project.title].impactLine,
  };
}

export async function FeaturedProjects() {
  const projects: ProjectData[] = (await getProjects()) || [];
  const fetchedTitles = new Set(projects.map((project) => project.title));
  const displayProjects = [
    ...projects,
    ...FALLBACK_PROJECTS.filter((project) => !fetchedTitles.has(project.title)),
  ].map(normalizeProject);

  return (
    <Section id="projects" title="Featured Projects" subtitle="Code you can inspect and use today">
      <ProjectCardList projects={displayProjects} />
    </Section>
  );
}
