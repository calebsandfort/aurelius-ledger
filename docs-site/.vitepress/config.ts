import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aurelius Ledger — Developer Docs',
  description: 'Technical documentation for developers and AI assistants',
  base: '/docs/',
  outDir: '../frontend/public/docs',
  cleanUrls: true,
  appearance: 'dark',
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: 'Architecture', link: '/architecture/' },
      { text: 'API', link: '/api/' },
      { text: 'Agents', link: '/agents/' },
      { text: 'Database', link: '/database/' },
      { text: 'Frontend', link: '/frontend/' },
    ],
    sidebar: {
      '/architecture/': [
        { text: 'Overview', items: [
          { text: 'Introduction', link: '/architecture/' },
        ]},
      ],
      '/api/': [
        { text: 'API Reference', items: [
          { text: 'Trade Endpoints', link: '/api/trades' },
          { text: 'Insights Endpoints', link: '/api/insights' },
          { text: 'Export Endpoints', link: '/api/export' },
        ]},
      ],
      '/agents/': [
        { text: 'AI Agents', items: [
          { text: 'Extraction Agent', link: '/agents/extraction' },
          { text: 'Insights Agent', link: '/agents/insights' },
        ]},
      ],
      '/database/': [
        { text: 'Database', items: [
          { text: 'Schema', link: '/database/schema' },
          { text: 'Migrations', link: '/database/migrations' },
        ]},
      ],
      '/frontend/': [
        { text: 'Frontend', items: [
          { text: 'Components', link: '/frontend/components' },
          { text: 'Hooks', link: '/frontend/hooks' },
        ]},
      ],
    },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
  },
})
