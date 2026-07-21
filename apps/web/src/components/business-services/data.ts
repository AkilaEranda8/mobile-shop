import type { LucideIcon } from 'lucide-react'
import {
  Building2, Palette, Sparkles, Globe, ShoppingBag, Smartphone,
  Printer, Link2, Server, Cloud, Mail, MessageSquare, MessageCircle,
  CreditCard, Megaphone, Search, ShieldCheck, Camera, Handshake,
} from 'lucide-react'

export const WHATSAPP_NUMBER = '94705800063'
export const SUPPORT_PHONE_DISPLAY = '070 580 0063'
export const SUPPORT_EMAIL = 'info@hexalyte.com'

export type ServicePackage = {
  id: string
  name: string
  price: string
  priceNote?: string
  badge?: string
  popular?: boolean
  features: string[]
  includesPrevious?: boolean
}

export type ServiceFaq = { q: string; a: string }

export type BusinessService = {
  slug: string
  title: string
  shortDescription: string
  description: string
  startingPrice: string
  icon: LucideIcon
  category: 'Registration' | 'Design' | 'Development' | 'Infrastructure' | 'Marketing' | 'Support'
  features: string[]
  packages: ServicePackage[]
  faqs: ServiceFaq[]
  note?: string
}

export const SERVICE_CATEGORIES = [
  'All',
  'Registration',
  'Design',
  'Development',
  'Infrastructure',
  'Marketing',
  'Support',
] as const

export const BUSINESS_SERVICES: BusinessService[] = [
  {
    slug: 'company-registration',
    title: 'Company Registration',
    shortDescription: 'Register your private limited company in Sri Lanka with end-to-end ROC support.',
    description:
      'Complete company incorporation services covering name reservation, form preparation, ROC submission, gazette process, and post-registration support so you can start operating legally and confidently.',
    startingPrice: 'LKR 29,500',
    icon: Building2,
    category: 'Registration',
    features: [
      'Full ROC process handling',
      'Name checking & reservation',
      'Articles of Association',
      'Bank account opening assistance',
      'Post-registration guidance',
    ],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 29,500',
        badge: 'Best for Startups',
        features: [
          'FREE Company Name Checking',
          'Company Name Reservation',
          'Preparation of Forms 01, 18, 19',
          'Articles of Association',
          'ROC Submission',
          'ROC Process Handling',
          'Gazette & Newspaper Process',
          'Bank Account Opening Assistance',
        ],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 39,000',
        badge: '⭐ Most Popular',
        popular: true,
        includesPrevious: true,
        features: [
          'Company Seal',
          'Director Stamp',
          'Company File',
          'Certified Copies',
          'FREE Board Resolution',
          'FREE Company Secretary Support (6 Months)',
        ],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 45,000',
        badge: '👑 Complete Solution',
        includesPrevious: true,
        features: [
          'TIN Registration',
          'FREE Secretary Service (1 Year)',
          '3 FREE Board Resolutions',
          'Post Registration Consultation',
        ],
      },
    ],
    faqs: [
      { q: 'How long does company registration take?', a: 'Typically 5–10 working days depending on ROC processing and name availability.' },
      { q: 'Do I need to visit in person?', a: 'Most of the process can be handled remotely. We guide you on any document signing requirements.' },
      { q: 'Is bank account opening included?', a: 'Yes — assistance with bank account opening is included in all packages.' },
    ],
  },
  {
    slug: 'logo-design',
    title: 'Logo Design',
    shortDescription: 'Memorable brand marks crafted for print, web, and social media.',
    description:
      'Professional logo design packages that deliver distinctive visual identity assets, source files, and usage guidelines tailored for modern businesses.',
    startingPrice: 'LKR 7,500',
    icon: Palette,
    category: 'Design',
    features: ['Multiple concepts', 'Unlimited revisions (selected plans)', 'Vector source files', 'Brand color palette', 'Social media adaptations'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 7,500',
        features: ['2 logo concepts', '2 revisions', 'PNG & JPG files', 'Basic color palette'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 15,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['4 logo concepts', 'Unlimited revisions', 'Vector (AI/SVG) files', 'Brand guidelines PDF', 'Social media kit'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 30,000',
        badge: 'Complete Brand Mark',
        features: ['6 concepts + monogram', 'Full brand book', 'Stationery mockups', 'Icon set', 'Priority delivery'],
      },
    ],
    faqs: [
      { q: 'Do I own the logo rights?', a: 'Yes. Full commercial usage rights are transferred upon final payment.' },
      { q: 'What files will I receive?', a: 'Depending on the package: PNG, JPG, SVG, and AI/EPS source files.' },
    ],
  },
  {
    slug: 'branding',
    title: 'Branding',
    shortDescription: 'Full brand identity systems that make your business look premium.',
    description:
      'End-to-end branding including visual identity, tone of voice, stationery, and digital brand assets so your business presents consistently everywhere.',
    startingPrice: 'LKR 25,000',
    icon: Sparkles,
    category: 'Design',
    features: ['Brand strategy', 'Visual identity system', 'Stationery design', 'Brand guidelines', 'Digital asset pack'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 25,000',
        features: ['Logo refresh or new mark', 'Color & typography system', 'Business card design', 'Basic brand guide'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 45,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Full visual identity', 'Letterhead & envelope', 'Social templates', 'Brand voice guidelines', 'Presentation theme'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 75,000',
        badge: 'Enterprise Brand',
        features: ['Complete brand system', 'Packaging concepts', 'Marketing collateral suite', 'Brand workshop', '12-month brand support'],
      },
    ],
    faqs: [
      { q: 'Is logo included in branding?', a: 'Yes. All branding packages include logo design or a professional refresh.' },
    ],
  },
  {
    slug: 'website-development',
    title: 'Website Development',
    shortDescription: 'Fast, modern business websites optimized for conversions and SEO.',
    description:
      'Custom business websites built with modern stacks, responsive layouts, CMS options, and performance best practices — ready for growth.',
    startingPrice: 'LKR 45,000',
    icon: Globe,
    category: 'Development',
    features: ['Responsive design', 'SEO foundations', 'Contact & lead forms', 'CMS-ready options', 'Speed optimization'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 45,000',
        features: ['Up to 5 pages', 'Mobile responsive', 'Contact form', 'Basic SEO setup', '1 month support'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 90,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Up to 12 pages', 'CMS admin panel', 'Blog module', 'Advanced SEO', 'Analytics setup', '3 months support'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 150,000',
        badge: 'Growth Ready',
        features: ['Custom UI/UX', 'Advanced integrations', 'Multilingual option', 'Performance audit', '6 months support'],
      },
    ],
    faqs: [
      { q: 'Do you provide hosting?', a: 'Hosting can be added separately via our Website Hosting or Cloud VPS packages.' },
    ],
  },
  {
    slug: 'ecommerce-website',
    title: 'E-Commerce Website',
    shortDescription: 'Sell online with a conversion-focused store, payments, and inventory tools.',
    description:
      'Full e-commerce builds with product catalogs, checkout, payment gateway integration, order management, and mobile-first shopping experiences.',
    startingPrice: 'LKR 95,000',
    icon: ShoppingBag,
    category: 'Development',
    features: ['Product catalog', 'Secure checkout', 'Payment integration', 'Order management', 'Mobile commerce UX'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 95,000',
        features: ['Up to 50 products', 'Cart & checkout', '1 payment gateway', 'Order emails', 'Basic admin'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 175,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Unlimited products', 'Coupons & discounts', 'Inventory sync options', 'Multi-gateway support', 'Shipping rules'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 275,000',
        badge: 'Scale Ready',
        features: ['Custom storefront UX', 'Advanced reporting', 'Marketplace-ready features', 'Priority SLA', 'Training session'],
      },
    ],
    faqs: [
      { q: 'Which payment gateways are supported?', a: 'We integrate major Sri Lankan and international gateways. Ask us for the current list.' },
    ],
  },
  {
    slug: 'mobile-app-development',
    title: 'Mobile App Development',
    shortDescription: 'Native-quality Android & iOS apps for customer engagement and operations.',
    description:
      'Cross-platform and native mobile application development for startups and enterprises — from MVP to production-ready apps with store deployment support.',
    startingPrice: 'LKR 250,000',
    icon: Smartphone,
    category: 'Development',
    features: ['iOS & Android', 'API integration', 'Push notifications', 'App Store submission help', 'Post-launch support'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 250,000',
        features: ['MVP app (core screens)', 'Cross-platform build', 'Basic admin API', 'Push notifications', 'Store listing support'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 450,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Full feature app', 'Auth & profiles', 'Payments module', 'Analytics', '3 months maintenance'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'Request Quote',
        badge: 'Enterprise',
        features: ['Complex workflows', 'Custom architecture', 'SLA & dedicated team', 'CI/CD pipeline', 'Ongoing product partnership'],
      },
    ],
    faqs: [
      { q: 'Do you publish to Play Store and App Store?', a: 'Yes — we assist with store listings, assets, and submission guidelines.' },
    ],
  },
  {
    slug: 'printing-services',
    title: 'Printing Services',
    shortDescription: 'Business stationery and marketing print materials, professionally produced.',
    description:
      'High-quality printing for everyday business needs — from cards and letterheads to banners, labels, and invoice books. Pricing based on quantity and finish.',
    startingPrice: 'Request Quote',
    icon: Printer,
    category: 'Design',
    features: [
      'Business Cards',
      'Letterheads',
      'Flyers',
      'Brochures',
      'Posters',
      'Banners',
      'Company File',
      'Stickers',
      'Product Labels',
      'Invoice Books',
      'Receipt Books',
      'ID Cards',
    ],
    packages: [
      {
        id: 'quote',
        name: 'Custom Print Order',
        price: 'Request Quote',
        features: [
          'Business Cards & Letterheads',
          'Flyers, Brochures & Posters',
          'Banners & Stickers',
          'Product Labels',
          'Invoice & Receipt Books',
          'Company Files & ID Cards',
          'Quantity-based pricing',
        ],
      },
    ],
    faqs: [
      { q: 'Can you design and print?', a: 'Yes. Design can be included or you can supply print-ready artwork.' },
    ],
  },
  {
    slug: 'domain-registration',
    title: 'Domain Registration',
    shortDescription: 'Secure .com, .lk and multi-domain portfolios with yearly renewals.',
    description:
      'Register and manage business domains with DNS guidance, renewal reminders, and optional privacy protection.',
    startingPrice: 'From LKR 3,500/year',
    icon: Link2,
    category: 'Infrastructure',
    features: ['Domain search & registration', 'DNS setup help', 'Renewal reminders', '.com and .lk support', 'Multi-domain management'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 3,500/year',
        priceNote: '.com Domain',
        features: ['.com domain registration', '1-year term', 'DNS configuration help', 'Email forwarding setup'],
      },
      {
        id: 'business',
        name: 'Business',
        price: 'LKR 5,500/year',
        priceNote: '.lk Domain',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['.lk domain registration', 'Local presence support', 'DNS management', 'Renewal monitoring'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Request Quote',
        priceNote: 'Multiple Domains',
        features: ['Multi-domain portfolio', 'Bulk registration', 'Centralized renewals', 'Priority support'],
      },
    ],
    faqs: [
      { q: 'Are prices yearly?', a: 'Yes. Domain packages are billed annually and renew each year.' },
    ],
  },
  {
    slug: 'website-hosting',
    title: 'Website Hosting',
    shortDescription: 'Reliable shared hosting with SSL-ready environments and support.',
    description:
      'Managed website hosting plans with uptime monitoring, backups, and friendly support for business sites and landing pages.',
    startingPrice: 'LKR 2,500/month',
    icon: Server,
    category: 'Infrastructure',
    features: ['SSD storage', 'Free SSL option', 'Daily backups (selected plans)', 'Email accounts', 'cPanel / control panel'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 2,500/month',
        features: ['1 website', '10 GB SSD', 'Free SSL', '5 email accounts', 'Weekly backups'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 5,000/month',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['3 websites', '40 GB SSD', 'Free SSL', 'Unlimited emails*', 'Daily backups'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 10,000/month',
        features: ['Unlimited websites*', '100 GB SSD', 'Priority support', 'Staging environment', 'Advanced security'],
      },
    ],
    faqs: [
      { q: 'Can I migrate my existing site?', a: 'Yes — migration assistance is available on Professional and Premium plans.' },
    ],
  },
  {
    slug: 'cloud-vps',
    title: 'Cloud VPS',
    shortDescription: 'Dedicated cloud VPS instances for apps, ERP, and high-traffic sites.',
    description:
      'Scalable virtual private servers with predictable resources, root access options, and plans sized for growing SaaS and business workloads.',
    startingPrice: 'LKR 6,500/month',
    icon: Cloud,
    category: 'Infrastructure',
    features: ['Dedicated vCPU & RAM', 'SSD storage', 'Full root access options', 'Snapshot backups', 'Scalable upgrades'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 6,500/month',
        features: ['2 vCPU', '4 GB RAM', '80 GB SSD', '1 TB bandwidth', 'Basic monitoring'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 12,500/month',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['4 vCPU', '8 GB RAM', '160 GB SSD', '2 TB bandwidth', 'Snapshot backups'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 24,900/month',
        badge: 'High Performance',
        features: ['8 vCPU', '16 GB RAM', '320 GB SSD', '4 TB bandwidth', 'Priority incident response'],
      },
    ],
    faqs: [
      { q: 'Is managed support available?', a: 'Yes — managed setup and monitoring can be added on request.' },
    ],
  },
  {
    slug: 'business-email',
    title: 'Business Email',
    shortDescription: 'Professional @yourdomain email with security and admin controls.',
    description:
      'Branded business email mailboxes that build trust with customers — including spam filtering, mobile sync, and admin management.',
    startingPrice: 'LKR 2,500',
    icon: Mail,
    category: 'Infrastructure',
    features: ['Custom domain email', 'Spam & malware filtering', 'Mobile & desktop sync', 'Admin console', 'Alias support'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 2,500',
        features: ['5 mailboxes', '10 GB per mailbox', 'Webmail access', 'Spam filter'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 5,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['15 mailboxes', '25 GB per mailbox', 'Aliases & groups', 'Priority support'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 9,500',
        features: ['40 mailboxes', '50 GB per mailbox', 'Advanced admin controls', 'Migration assistance'],
      },
    ],
    faqs: [
      { q: 'Is this monthly or one-time?', a: 'Business email plans are typically billed monthly per mailbox tier. Confirm during onboarding.' },
    ],
  },
  {
    slug: 'sms-gateway',
    title: 'SMS Gateway',
    shortDescription: 'Transactional and promotional SMS API for OTPs, alerts, and campaigns.',
    description:
      'Reliable SMS gateway setup with API access, sender ID support, and dashboard reporting for OTPs, order updates, and marketing messages.',
    startingPrice: 'LKR 2,500',
    icon: MessageSquare,
    category: 'Infrastructure',
    note: 'SMS Credits are charged separately.',
    features: ['API integration', 'Sender ID support', 'Delivery reports', 'OTP-ready', 'Bulk campaigns'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 2,500',
        priceNote: 'One-Time Setup',
        features: ['API credentials', 'Basic dashboard', 'Documentation', 'Test credits guidance'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 7,500',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Advanced API features', 'Sender ID setup help', 'Webhook callbacks', 'Priority onboarding'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 15,000',
        features: ['Custom integration support', 'High-volume readiness', 'Dedicated onboarding', 'SLA-backed support'],
      },
    ],
    faqs: [
      { q: 'Are SMS credits included?', a: 'No. Setup packages are separate from SMS credit top-ups, which are charged separately.' },
    ],
  },
  {
    slug: 'whatsapp-business-api',
    title: 'WhatsApp Business API',
    shortDescription: 'Official WhatsApp Business API for support, sales, and notifications.',
    description:
      'Get set up on the WhatsApp Business API for verified messaging, chatbots, templates, and CRM integrations that scale customer conversations.',
    startingPrice: 'LKR 15,000',
    icon: MessageCircle,
    category: 'Infrastructure',
    features: ['Official API onboarding', 'Message templates', 'Chatbot options', 'CRM integrations', 'Team inbox setups'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 15,000',
        features: ['API onboarding support', 'Template setup', 'Basic chatbot', 'Team training'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 35,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Advanced chatbot flows', 'CRM sync', 'Multi-agent inbox', 'Analytics dashboard'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 65,000',
        badge: 'Enterprise Messaging',
        features: ['Custom workflows', 'Priority green-tick guidance', 'Dedicated success manager', 'SLA support'],
      },
    ],
    faqs: [
      { q: 'Is Meta conversation pricing included?', a: 'Meta/WhatsApp conversation fees are billed by the provider and are separate from our setup packages.' },
    ],
  },
  {
    slug: 'payment-gateway',
    title: 'Payment Gateway',
    shortDescription: 'Accept cards and online payments with secure gateway integrations.',
    description:
      'Integrate payment gateways into your website, app, or ERP — including checkout flows, webhooks, and reconciliation guidance.',
    startingPrice: 'LKR 15,000',
    icon: CreditCard,
    category: 'Infrastructure',
    features: ['Gateway account setup help', 'Checkout integration', 'Webhook handling', 'Test & live modes', 'Reconciliation tips'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 15,000',
        features: ['1 gateway integration', 'Checkout page setup', 'Basic webhooks', 'Go-live checklist'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 25,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['2 gateway options', 'Refund flows', 'Invoice payment links', 'Error monitoring'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 40,000',
        features: ['Multi-gateway routing', 'Custom reconciliation', 'ERP integration support', 'Priority support'],
      },
    ],
    faqs: [
      { q: 'Do you handle merchant account approval?', a: 'We guide the application process; final approval depends on the payment provider.' },
    ],
  },
  {
    slug: 'digital-marketing',
    title: 'Digital Marketing',
    shortDescription: 'Paid ads and social campaigns that generate qualified leads.',
    description:
      'Monthly digital marketing retainers covering Meta/Google ads, creative testing, and performance reporting focused on business growth.',
    startingPrice: 'LKR 20,000/month',
    icon: Megaphone,
    category: 'Marketing',
    features: ['Ad account setup', 'Campaign strategy', 'Creative testing', 'Lead tracking', 'Monthly reports'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 20,000/month',
        features: ['1 platform management', 'Ad creatives (basic)', 'Weekly optimization', 'Monthly report'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 40,000/month',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Meta + Google', 'A/B creative testing', 'Landing page advice', 'Bi-weekly reporting'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 75,000/month',
        badge: 'Growth Retainer',
        features: ['Full-funnel strategy', 'Advanced tracking', 'Creative production', 'Dedicated strategist'],
      },
    ],
    faqs: [
      { q: 'Is ad spend included?', a: 'No. Media spend is paid directly to ad platforms and is separate from the retainer.' },
    ],
  },
  {
    slug: 'seo-services',
    title: 'SEO Services',
    shortDescription: 'Rank higher on Google with technical SEO, content, and link strategy.',
    description:
      'Search engine optimization retainers that improve visibility through technical fixes, on-page optimization, content planning, and authority building.',
    startingPrice: 'LKR 20,000/month',
    icon: Search,
    category: 'Marketing',
    features: ['Technical SEO audit', 'On-page optimization', 'Keyword research', 'Content recommendations', 'Monthly ranking reports'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 20,000/month',
        features: ['Keyword research', 'On-page fixes (core pages)', 'Technical audit', 'Monthly report'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 40,000/month',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Expanded page optimization', 'Content calendar', 'Local SEO', 'Competitor tracking'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 60,000/month',
        features: ['Aggressive growth plan', 'Link building strategy', 'Content production support', 'Priority consulting'],
      },
    ],
    faqs: [
      { q: 'How soon will I see results?', a: 'SEO is a medium-to-long term channel. Meaningful movement often starts within 2–4 months.' },
    ],
  },
  {
    slug: 'ssl-security',
    title: 'SSL & Security',
    shortDescription: 'Protect your website with SSL certificates and security hardening.',
    description:
      'SSL certificate installation and website security packages including hardening, monitoring options, and best-practice configurations.',
    startingPrice: 'LKR 5,000/year',
    icon: ShieldCheck,
    category: 'Infrastructure',
    features: ['SSL certificate', 'HTTPS redirect', 'Security headers', 'Vulnerability basics', 'Renewal management'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 5,000/year',
        features: ['Standard SSL', 'Installation & renewals', 'HTTPS force redirect'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 12,500/year',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Premium SSL', 'Security headers', 'Malware scan setup', 'Firewall basics'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 25,000/year',
        features: ['Wildcard / advanced SSL', 'Hardening checklist', 'Monitoring alerts', 'Priority incident help'],
      },
    ],
    faqs: [
      { q: 'Will my site show the padlock?', a: 'Yes — after correct SSL installation and HTTPS configuration.' },
    ],
  },
  {
    slug: 'photography-videography',
    title: 'Photography & Videography',
    shortDescription: 'Product, brand, and promotional photo/video content for marketing.',
    description:
      'Professional photo and video production for products, services, and brand storytelling — delivered ready for web, social, and ads.',
    startingPrice: 'LKR 15,000',
    icon: Camera,
    category: 'Marketing',
    features: ['Product photography', 'Brand lifestyle shoots', 'Promotional videos', 'Social cutdowns', 'Licensed commercial use'],
    packages: [
      {
        id: 'starter',
        name: 'Starter',
        price: 'LKR 15,000',
        features: ['Half-day shoot', 'Edited photo set', 'Basic color grading', 'Web-ready exports'],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 'LKR 30,000',
        badge: '⭐ Most Popular',
        popular: true,
        features: ['Full-day shoot', 'Photo + short video', 'Multiple locations', 'Social edits'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'LKR 60,000',
        features: ['Multi-day production', 'Cinematic brand film', 'Advanced editing', 'Usage rights package'],
      },
    ],
    faqs: [
      { q: 'Do you travel on location?', a: 'Yes. Location shoots are available; travel may affect the final quote.' },
    ],
  },
  {
    slug: 'business-consultation',
    title: 'Business Consultation',
    shortDescription: 'Expert advisory sessions for growth, systems, and digital transformation.',
    description:
      'One-on-one consultation with Hexalyte specialists covering business setup, digital strategy, operations, and technology decisions.',
    startingPrice: 'LKR 5,000/hour',
    icon: Handshake,
    category: 'Support',
    features: ['Strategy sessions', 'Process review', 'Tech stack advice', 'Growth planning', 'Actionable next steps'],
    packages: [
      {
        id: 'hourly',
        name: 'Hourly Consultation',
        price: 'LKR 5,000/hour',
        features: [
          '1:1 advisory call',
          'Business & digital strategy',
          'Systems & tooling recommendations',
          'Written action summary',
          'Follow-up resources',
        ],
      },
    ],
    faqs: [
      { q: 'Can consultation be credited toward a project?', a: 'Often yes — ask us when you book; applicable fees may be credited on selected packages.' },
    ],
  },
]

export function getServiceBySlug(slug: string): BusinessService | undefined {
  return BUSINESS_SERVICES.find((s) => s.slug === slug)
}

export const WHY_CHOOSE = [
  { title: 'Fast Processing', desc: 'Clear timelines and proactive follow-ups.' },
  { title: 'Professional Team', desc: 'Specialists across legal, design, and tech.' },
  { title: 'Transparent Pricing', desc: 'Package pricing with no hidden surprises.' },
  { title: 'Trusted Partner', desc: 'Businesses rely on Hexalyte for growth.' },
  { title: '100% Legal Process', desc: 'Compliant company and compliance workflows.' },
  { title: 'Dedicated Support', desc: 'Real humans when you need answers.' },
  { title: 'After Sales Support', desc: 'We stay available after delivery.' },
  { title: 'Business Growth Partner', desc: 'From launch to scale — one partner.' },
] as const

export const QUICK_STATS = [
  'Professional Team',
  'Fast Processing',
  'Transparent Pricing',
  'Trusted Business Partner',
] as const
