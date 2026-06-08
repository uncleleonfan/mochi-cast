export interface SiteContent {
  meta: { title: string; description: string };
  seo: {
    siteName: string;
    keywords: string[];
    pages: {
      home: { title: string; description: string };
      download: { title: string; description: string };
      guide: { title: string; description: string };
      compatibility: { title: string; description: string };
      privacy: { title: string; description: string };
    };
  };
  nav: {
    home: string;
    download: string;
    guide: string;
    compatibility: string;
    privacy: string;
    github: string;
  };
  hero: {
    title: string;
    subtitle: string;
    description: string;
    downloadZip: string;
    installGuide: string;
    chromeStore: string;
    chromeStoreBefore: string;
    chromeStoreAfter: string;
    github: string;
  };
  features: {
    title: string;
    items: { title: string; description: string }[];
  };
  steps: {
    title: string;
    items: { title: string; description: string }[];
  };
  brands: { title: string; items: string[] };
  footer: { tagline: string; license: string };
  download: {
    title: string;
    description: string;
    zipSectionTitle: string;
    zipSectionBadge: string;
    zipButton: string;
    releaseLink: string;
    zipNote: string;
    chromeSectionTitle: string;
    chromeSectionDescription: string;
    chromeStoreButton: string;
    requirements: string;
    reqItems: string[];
    stepsTitle: string;
    steps: string[];
  };
  guide: {
    title: string;
    quickStartTitle: string;
    quickStart: string[];
    tvSetupTitle: string;
    tvSetups: { brand: string; steps: string[] }[];
    formatsTitle: string;
    formats: { type: string; support: string; ok: boolean }[];
    faqTitle: string;
    faq: { q: string; a: string }[];
  };
  compatibility: {
    title: string;
    description: string;
    legendTitle: string;
    legend: { icon: string; label: string }[];
    domesticTitle: string;
    domesticHeaders: string[];
    domesticRows: string[][];
    overseasTitle: string;
    overseasHeaders: string[];
    overseasRows: string[][];
    contribute: string;
    limitsTitle: string;
    limits: string[];
  };
  privacy: {
    title: string;
    updated: string;
    summaryTitle: string;
    summary: string;
    accessTitle: string;
    access: { label: string; text: string }[];
    notCollectTitle: string;
    notCollect: string[];
    websiteTitle: string;
    websiteAnalytics: string;
    permissionsTitle: string;
    permissions: string[];
    contactTitle: string;
    contact: string;
    supportEmailLabel: string;
    contactIssuesBefore: string;
    contactIssuesAfter: string;
  };
}
