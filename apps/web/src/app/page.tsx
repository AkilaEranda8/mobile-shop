'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Smartphone, Wrench, BarChart3, Shield, Zap, Globe, CheckCircle,
  ArrowRight, Star, Users, TrendingUp, Package, QrCode, Wifi,
  Menu, X, ChevronRight, Building2, CreditCard, Bell, Mail, Phone
} from 'lucide-react'

const COMPANY = {
  name: 'Hexalyte Innovation (Pvt) Ltd',
  email: 'info@hexalyte.com',
  phone: '+94 70 3130100',
  website: 'www.hexalyte.com',
  tagline: 'ශ්‍රී ලංකාවේ මොබයිල් කඩ සාප්පු සඳහා සම්පූර්ණ SaaS වේදිකාව',
}

const features = [
  {
    icon: Zap,
    title: 'වේගවත් POS',
    description: 'බාර්කෝඩ් ස්කෑන්, IMEI ඇතුළත් කිරීම, බෙදීම් ගෙවීම් සහ තාප + PDF රිසිට් — අන්තර්ජාලය නොමැතිවද ක්‍රියා කරයි.',
    color: 'from-yellow-500/20 to-orange-500/10',
    border: 'border-yellow-500/20',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Wrench,
    title: 'අලුත්වැඩියා කළමනාකරණය',
    description: 'තාක්ෂණිකයා පැවරීම, කොටස් අඩු කිරීම සහ පොදු අනුගමන පෝර්ටල් සමඟ සම්පූර්ණ අලුත්වැඩියා ක්‍රමවේදය.',
    color: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: Smartphone,
    title: 'IMEI අනුගමනය',
    description: 'මිලදී ගැනීමේ සිට විකිණීම සහ වarranty දක්වා IMEI මගින් සෑම උපාංගයම අනුගමනය කරයි.',
    color: 'from-violet-500/20 to-purple-500/10',
    border: 'border-violet-500/20',
    iconColor: 'text-violet-400',
  },
  {
    icon: Shield,
    title: 'වarranty කළමනාකරණය',
    description: 'QR සත්‍යාපනය සහිත වarranty සහතික, කල් ඉකුත් ඇතිකිරීම් සහ වarranty ඉල්ලීම් ක්‍රමවේදය.',
    color: 'from-green-500/20 to-emerald-500/10',
    border: 'border-green-500/20',
    iconColor: 'text-green-400',
  },
  {
    icon: Building2,
    title: 'බහු ශාඛා',
    description: 'එක් ඩෑෂ්බෝඩ් එකෙන් අසීමිත ශාඛා කළමනාකරණය. ගබඩා මාරුව, ශාඛා අවසර සහ ඒකාබද්ධ වාර්තා.',
    color: 'from-pink-500/20 to-rose-500/10',
    border: 'border-pink-500/20',
    iconColor: 'text-pink-400',
  },
  {
    icon: BarChart3,
    title: 'විශ්ලේෂණ සහ වාර්තා',
    description: 'ආදායම් ප්‍රස්ථාර, ජනප්‍රිය නිෂ්පාදන, තාක්ෂණික KPI සහ ශාඛා සංසන්ධන — සජීවීව.',
    color: 'from-cyan-500/20 to-sky-500/10',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
]

const plans = [
  {
    name: 'Starter',
    price: 'Rs. 2,999',
    period: '/මාසය',
    description: 'එක් ශාඛාවක් සහිත කඩ සාප්පු සඳහා',
    color: 'border-white/10',
    badge: null,
    features: [
      '1 ශාඛාව',
      '3 පරිශීලකයන් දක්වා',
      '500 නිෂ්පාදන',
      'POS සහ බිල්පත්',
      'මූලික ගබඩා කළමනාකරණය',
      'ගනුදෙනුකරු කළමනාකරණය',
      'SMS දැනුම්දීම්',
      'ඊමේල් සහාය',
    ],
    cta: 'නොමිලේ ආරම්භ කරන්න',
    ctaStyle: 'btn-secondary',
  },
  {
    name: 'Pro',
    price: 'Rs. 4,999',
    period: '/මාසය',
    description: 'බහු ශාඛා සහිත වර්ධනය වන කඩ සාප්පු සඳහා',
    color: 'border-violet-500/50',
    badge: 'වඩාත් ජනප්‍රිය',
    features: [
      '5 ශාඛා',
      '15 පරිශීලකයන් දක්වා',
      '5,000 නිෂ්පාදන',
      'Starter හි සියල්ල',
      'අලුත්වැඩියා කළමනාකරණය',
      'වarranty කළමනාකරණය',
      'සැපයුම්කරු සහ PO මොඩියුල',
      'විස්තරාත්මක විශ්ලේෂණ',
      'Offline POS (Electron)',
      'WhatsApp සම්බන්ධතාව',
      'විශේෂ සහාය',
    ],
    cta: 'නොමිලේ ආරම්භ කරන්න',
    ctaStyle: 'btn-primary',
  },
  {
    name: 'Enterprise',
    price: 'අභිරුචි',
    period: '',
    description: 'විශාල වෙළධ භාණ්ඩ සාප්පු සහ franchise සඳහා',
    color: 'border-cyan-500/30',
    badge: null,
    features: [
      'අසීමිත ශාඛා',
      'අසීමිත පරිශීලකයන්',
      'අසීමිත නිෂ්පාදන',
      'Pro හි සියල්ල',
      'White Label',
      'API ප්‍රවේශය',
      'විශේෂ ගිණුම් කළමනාකරු',
      'අභිරුචි සම්බන්ධතා',
      'SLA සහතිකය',
      'On-premise විකල්පය',
    ],
    cta: 'අප අමතන්න',
    ctaStyle: 'btn-secondary',
  },
]

const stats = [
  { value: '500+', label: 'ක්‍රියාත්මක කඩ සාප්පු', icon: Building2 },
  { value: '50,000+', label: 'අලුත්වැඩියා අනුගමනය', icon: Wrench },
  { value: 'LKR 2B+', label: 'සැකසූ ආදායම', icon: TrendingUp },
  { value: '99.9%', label: 'Uptime SLA', icon: Zap },
]

const testimonials = [
  {
    name: 'නිමල් පෙරේරා',
    shop: 'නිමල් මොබයිල්ස්, කොළඹ',
    avatar: 'න',
    rating: 5,
    text: 'Hexalyte අපගේ 3 ශාඛා ක්‍රියාකාරිත්වය සම්පූර්ණයෙන් වෙනස් කළා. IMEI අනුගමනය සහ අලුත්වැඩියා කළමනාකරණය දිනපතා වැඩකාරයන් රැඳවීම.',
  },
  {
    name: 'සුනිල් ජයසිංහ',
    shop: 'Smart Phone Hub, ගාල්ල',
    avatar: 'ස',
    rating: 5,
    text: 'POS ඉතා වේගවත්. බිල්පත් කාලය 60% අඩු වුණා. ගනුදෙනුකරුවන් WhatsApp රිසිට් විශේෂාංගයට ආසාවෙන් සිටිනවා!',
  },
  {
    name: 'කමල් සිල්වා',
    shop: 'Galaxy Mobile World, කැන්ඩි',
    avatar: 'ක',
    rating: 5,
    text: 'අපගේ 5 ශාඛා සාප්පු සඳහා හොඳම ආයෝජනය. වarranty කළමනාකරණය අපට වාසික තරඟකාරීත්වය ලබා දෙනවා.',
  },
]

function Logo({ className = 'h-10' }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt={COMPANY.name}
      className={`${className} w-auto object-contain`}
      style={{ mixBlendMode: 'screen' }}
    />
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-200 overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-violet-800/8 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="h-9" />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">විශේෂාංග</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">මිල ගණන්</a>
              <a href="#testimonials" className="text-sm text-slate-400 hover:text-white transition-colors">අදහස්</a>
              <a href="#company" className="text-sm text-slate-400 hover:text-white transition-colors">අප ගැන</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm text-slate-400 hover:text-white px-4 py-2 transition-colors">
                පිවිසෙන්න
              </Link>
              <Link href="/register" className="btn-primary text-sm py-2 px-5">
                නොමිලේ ආරම්භ කරන්න
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0f1623] px-4 py-4 space-y-3">
            <div className="flex justify-center pb-3 border-b border-white/5">
              <Logo className="h-12" />
            </div>
            <a href="#features" className="block text-slate-400 hover:text-white py-2 text-sm" onClick={() => setMobileMenuOpen(false)}>විශේෂාංග</a>
            <a href="#pricing" className="block text-slate-400 hover:text-white py-2 text-sm" onClick={() => setMobileMenuOpen(false)}>මිල ගණන්</a>
            <a href="#testimonials" className="block text-slate-400 hover:text-white py-2 text-sm" onClick={() => setMobileMenuOpen(false)}>අදහස්</a>
            <a href="#company" className="block text-slate-400 hover:text-white py-2 text-sm" onClick={() => setMobileMenuOpen(false)}>අප ගැන</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" className="btn-secondary text-sm text-center">පිවිසෙන්න</Link>
              <Link href="/register" className="btn-primary text-sm text-center">නොමිලේ ආරම්භ කරන්න</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-16 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <Logo className="h-20 sm:h-28" />
          </div>

          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Flutter මොබයිල් යෙදුම + Electron POS දැන් ලබා ගත හැක</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-tight mb-6">
            නවීන මොබයිල් කඩ සාප්පු සඳහා{' '}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              සම්පූර්ණ වේදිකාව
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            ගබඩා, අලුත්වැඩියා, බිල්පත්, වarranty සහ ගනුදෙනුකරු කළමනාකරණය එක් ප්‍රබල වේදිකාවකින්.
            තනි කඩ සාප්පු සහ බහු ශාඛා වෙළධ භාණ්ඩ සාප්පු සඳහා නිර්මාණය කර ඇත.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register" className="btn-primary text-base px-8 py-3.5 flex items-center gap-2 group w-full sm:w-auto justify-center">
              14 දින නොමිලේ ආරම්භ කරන්න
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/dashboard" className="btn-secondary text-base px-8 py-3.5 flex items-center gap-2 w-full sm:w-auto justify-center">
              Live Demo බලන්න
              <ChevronRight size={18} />
            </Link>
          </div>

          {/* Dashboard Preview */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0f1623] overflow-hidden shadow-2xl shadow-violet-900/20">
            <div className="bg-[#0a0f1a] border-b border-white/5 px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <div className="flex-1 mx-4 bg-white/5 rounded-md h-6 flex items-center px-3">
                <span className="text-xs text-slate-500">app.hexalyte.com/dashboard</span>
              </div>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'අදගේ ආදායම', value: 'LKR 142,000', change: '+12.4%', up: true },
                { label: 'සක්‍රිය අලුත්වැඩියා', value: '12', change: 'ඊයේට -3', up: false },
                { label: 'සම්පූර්ණ ගනුදෙනුකරු', value: '1,842', change: 'අද +8', up: true },
                { label: 'බැඳි ණය', value: 'LKR 68,500', change: '5 ගනුදෙනුකරු', up: false },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/3 border border-white/5 rounded-xl p-3 sm:p-4">
                  <p className="text-xs text-slate-500 mb-2">{stat.label}</p>
                  <p className="text-base sm:text-lg font-bold text-white">{stat.value}</p>
                  <p className={`text-xs mt-1 ${stat.up ? 'text-green-400' : 'text-slate-400'}`}>{stat.change}</p>
                </div>
              ))}
            </div>
            <div className="px-4 sm:px-6 pb-6">
              <div className="bg-white/3 border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-300">ආදායම — අවසන් 7 දින</span>
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">↑ 18.2% පසුගිය සතියට</span>
                </div>
                <div className="flex items-end gap-1.5 h-24">
                  {[65, 85, 45, 90, 72, 95, 58].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end">
                      <div
                        className="rounded-t bg-gradient-to-t from-violet-600 to-violet-400 opacity-80"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {['සඳු', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන', 'සට', 'ඉරි'].map((d) => (
                    <span key={d} className="text-xs text-slate-600 flex-1 text-center">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-white/5 bg-white/2">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-1">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
              ඔබේ කඩ සාප්පුට අවශ්‍ය සියල්ල,{' '}
              <span className="gradient-text">අනවශ්‍ය දේ නැත</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              මොබයිල් වෙළධ භාණ්ඩ කර්මාන්තය සඳහා නිර්මාණය කළ 10 සම්බන්ධිත මොඩියුල.
              IMEI අනුගමනයේ සිට වarranty කළමනාකරණය දක්වා.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`rounded-2xl border ${feature.border} bg-gradient-to-br ${feature.color} p-6 hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 ${feature.iconColor}`}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Additional capabilities */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: QrCode, text: 'QR බිල්පත් සහ වarranty' },
              { icon: Wifi, text: 'Offline-First POS' },
              { icon: Bell, text: 'SMS සහ WhatsApp දැනුම්දීම්' },
              { icon: CreditCard, text: 'බෙදීම් ගෙවීම්' },
              { icon: Package, text: 'සැපයුම්කරු සහ PO' },
              { icon: Users, text: 'Role-Based Access' },
              { icon: Globe, text: 'පොදු අලුත්වැඩියා පෝර්ටල්' },
              { icon: TrendingUp, text: 'ශාඛා සංසන්ධන විශ්ලේෂණ' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3">
                <item.icon size={16} className="text-violet-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 bg-white/2">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">සරල, පැහැදිලි මිල ගණන් (LKR)</h2>
            <p className="text-slate-400">14 දින නොමිලේ ආරම්භ කරන්න. ක්‍රෙඩිට් කාඩ් අවශ්‍ය නොවේ.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border ${plan.color} bg-[#0f1623] p-6 flex flex-col ${plan.badge ? 'ring-1 ring-violet-500/50' : ''}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.period}</span>
                  </div>
                </div>

                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle size={16} className="text-violet-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`${plan.ctaStyle} text-center text-sm`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">ශ්‍රී ලංකාවේ කඩ සාප්පු හිමිකරුවන්ගේ අදහස්</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-[#0f1623] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">&quot;{t.text}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.shop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company details */}
      <section id="company" className="py-24 px-4 bg-white/2">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#0f1623] border border-white/10 rounded-3xl p-8 sm:p-10">
            <div className="flex flex-col items-center text-center mb-8">
              <Logo className="h-16 sm:h-20 mb-4" />
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{COMPANY.name}</h2>
              <p className="text-slate-400 text-sm sm:text-base">{COMPANY.tagline}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href={`mailto:${COMPANY.email}`}
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3 hover:border-violet-500/30 transition-colors"
              >
                <Mail size={18} className="text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">ඊමේල්</p>
                  <p className="text-sm text-white">{COMPANY.email}</p>
                </div>
              </a>
              <a
                href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3 hover:border-violet-500/30 transition-colors"
              >
                <Phone size={18} className="text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">දුරකථන</p>
                  <p className="text-sm text-white">{COMPANY.phone}</p>
                </div>
              </a>
              <a
                href={`https://${COMPANY.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3 hover:border-violet-500/30 transition-colors sm:col-span-2"
              >
                <Globe size={18} className="text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">වෙබ් අඩවිය</p>
                  <p className="text-sm text-white">{COMPANY.website}</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-violet-600/20 to-cyan-600/10 border border-violet-500/20 rounded-3xl p-8 sm:p-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              ඔබේ මොබයිල් කඩ සාප්පුව නවීන කරන්න
            </h2>
            <p className="text-slate-400 mb-8">
              Hexalyte මත දැනටමත් ක්‍රියාත්මක 500+ කඩ සාප්පු සමඟ එක්වන්න. අද 14 දින නොමිලේ ආරම්භ කරන්න.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="btn-primary text-base px-10 py-3.5 flex items-center justify-center gap-2">
                නොමිලේ ආරම්භ කරන්න
                <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn-secondary text-base px-10 py-3.5">
                පිවිසෙන්න
              </Link>
            </div>
            <p className="text-xs text-slate-600 mt-6">ක්‍රෙඩිට් කාඩ් අවශ්‍ය නොවේ • ඕනෑම වේලාවක අවලංගු කරන්න • 14 දින නොමිලේ</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Logo className="h-10" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">{COMPANY.name}</p>
              <p className="text-sm text-slate-500 max-w-xs mb-3">{COMPANY.tagline}</p>
              <div className="space-y-1 text-sm text-slate-500">
                <p>{COMPANY.email}</p>
                <p>{COMPANY.phone}</p>
                <p>{COMPANY.website}</p>
              </div>
            </div>
            {[
              { title: 'නිෂ්පාදන', links: ['විශේෂාංග', 'මිල ගණන්', 'Changelog', 'Roadmap'] },
              { title: 'සමාගම', links: ['අප ගැන', 'Blog', 'Careers', 'අමතන්න'] },
              { title: 'නීතිමය', links: ['Privacy', 'Terms', 'Security', 'Compliance'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-slate-300 mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</p>
            <p className="text-sm text-slate-600">ශ්‍රී ලංකාවේ නිර්මාණය කර ඇත ❤️</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
