import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aurelius Ledger — Help',
  description: 'User guide and walkthroughs',
  base: '/help/',
  outDir: '../frontend/public/help',
  cleanUrls: true,
  appearance: 'dark',
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Features', link: '/features/' },
      { text: 'FAQ', link: '/faq/' },
    ],
    sidebar: {
      '/getting-started/': [
        { text: 'Getting Started', items: [
          { text: 'Welcome', link: '/getting-started/' },
          { text: 'Setup Guide', link: '/getting-started/setup' },
        ]},
      ],
      '/features/': [
        { text: 'Features', items: [
          { text: 'Trade Logging', link: '/features/trade-logging' },
          { text: 'Dashboard', link: '/features/dashboard' },
          { text: 'AI Insights', link: '/features/ai-insights' },
        ]},
      ],
      '/faq/': [
        { text: 'FAQ', items: [
          { text: 'Common Questions', link: '/faq/' },
        ]},
      ],
    },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
  },
})
