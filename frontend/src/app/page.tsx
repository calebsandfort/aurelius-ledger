"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  TrendingUp,
  MessageSquare,
  Activity,
  History,
  ShieldCheck,
  Target,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Quote,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const quotes = [
  { text: "The market is a voting machine in the short run, a weighing machine in the long run.", context: "On PnL Tracking" },
  { text: "Risk comes from not knowing what you're doing.", context: "On Trade Journaling" },
  { text: "The most important thing is to manage your risk, not your returns.", context: "On Discipline" },
  { text: "Know what you own, and know why you own it.", context: "On Setup Documentation" },
]

const sidecarFeatures = [
  "Low-latency FastAPI background agents",
  "High-density P&L visualization",
  "AI-powered session insights",
]

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"execution" | "insights">("execution")
  const [currentQuote, setCurrentQuote] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % quotes.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  const nextQuote = () => setCurrentQuote((prev) => (prev + 1) % quotes.length)
  const prevQuote = () => setCurrentQuote((prev) => (prev - 1 + quotes.length) % quotes.length)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40">
                <TrendingUp size={18} className="text-slate-950" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Aurelius <span className="text-blue-500">Ledger</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#sidecar"
                className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
              >
                Methodology
              </a>
              <Button
                variant="outline"
                className="rounded-full text-xs px-5 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                asChild
              >
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button
                className="rounded-full text-xs px-5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                asChild
              >
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-slate-400 hover:text-white"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-slate-950 border-t border-slate-900 px-4 py-6 space-y-4">
            <a
              href="#features"
              className="block text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-white"
            >
              Features
            </a>
            <a
              href="#sidecar"
              className="block text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-white"
            >
              Methodology
            </a>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full text-xs border-slate-700 text-slate-300"
                asChild
              >
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button
                className="flex-1 rounded-full text-xs bg-blue-600 hover:bg-blue-500 text-white"
                asChild
              >
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-28 lg:pt-56 lg:pb-40 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute top-1/3 right-1/4 translate-x-1/2 w-[600px] h-[400px] bg-rose-600/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-[10px] font-bold uppercase tracking-widest mb-10">
            <span className="text-blue-500 flex items-center gap-1.5">
              <Target size={10} /> Trade Logging
            </span>
            <span className="text-slate-700 mx-1">|</span>
            <span className="text-rose-400 flex items-center gap-1.5">
              <Activity size={10} /> AI Insights
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-tighter mb-8 leading-[1.05]">
            Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-400 to-blue-700">
              Trades
            </span>{" "}
            tell the
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-rose-400 to-indigo-500">
              Truth
            </span>.
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-12 leading-relaxed font-light">
            Aurelius Ledger is an AI-powered trading journal. Type your trade in plain English—AI extracts
            direction, P&L, setup, discipline score, and agency score instantly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-base transition-all shadow-xl shadow-blue-900/20">
              Get Started
            </button>
            <button className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white border border-slate-700 rounded-full font-bold text-base hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
              See How It Works <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Dual Core Section */}
      <section className="py-24 bg-slate-900/40 relative" id="concept">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Tab Interface */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl hover:border-slate-700 transition-colors">
              <div className="flex bg-slate-900/50 p-1">
                <button
                  onClick={() => setActiveTab("execution")}
                  className={`flex-1 py-3 text-[10px] font-black tracking-[0.2em] rounded-2xl transition-all ${
                    activeTab === "execution"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  EXECUTION
                </button>
                <button
                  onClick={() => setActiveTab("insights")}
                  className={`flex-1 py-3 text-[10px] font-black tracking-[0.2em] rounded-2xl transition-all ${
                    activeTab === "insights"
                      ? "bg-rose-600 text-white shadow-lg"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  INSIGHTS
                </button>
              </div>

              <div className="p-10 min-h-[400px] flex flex-col justify-center">
                {activeTab === "execution" ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                        <MessageSquare size={24} />
                      </div>
                      <div className="text-[10px] font-mono text-blue-500/60 uppercase tracking-widest">
                        Trade Entry Active
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white">AI Trade Extraction</h3>
                    <p className="text-slate-400 leading-relaxed italic">
                      "Long ES at 4850. Hit target at 4875 for +$1,250. Setup: Trend continuation
                      off overnight low. Discipline: 9/10. Agency: 8/10."
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 rounded">
                        LONG
                      </span>
                      <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 rounded">
                        +$1,250
                      </span>
                      <span className="px-3 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 rounded">
                        DISCIPLINE: 9/10
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 border border-rose-500/20">
                        <Activity size={24} />
                      </div>
                      <div className="text-[10px] font-mono text-rose-400/60 uppercase tracking-widest">
                        Session Insights Live
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white">AI-Powered Analysis</h3>
                    <p className="text-slate-400 leading-relaxed">
                      Real-time insights from your trading session. Track discipline and agency scores
                      to identify patterns in your performance.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                        <span>Agency Score</span>
                        <span className="text-green-400">Above Average</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-500 to-green-500 w-[78%]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content Side */}
            <div className="lg:pl-10 space-y-12">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-white leading-tight">
                  Log Trades.
                  <br />
                  <span className="text-blue-500 font-serif italic">Build Edge.</span>
                </h2>
                <p className="text-slate-400 text-lg">
                  Aurelius Ledger combines natural language trade entry with AI-powered insights to help
                  you understand what drives your performance.
                </p>
              </div>

              <div className="space-y-8">
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-blue-500 border border-slate-800 group-hover:border-blue-500/50 transition-colors">
                    <MessageSquare size={22} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white">Natural Language Entry</h4>
                    <p className="text-slate-400 mt-1">
                      Just type what happened. AI extracts direction, P&L, setup description, and scores
                      automatically.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-rose-400 border border-slate-800 group-hover:border-rose-500/50 transition-colors">
                    <Activity size={22} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white">AI Session Insights</h4>
                    <p className="text-slate-400 mt-1">
                      Real-time analysis of your discipline and agency scores, with actionable insights
                      to improve.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-28" id="features">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
              The Complete Trading Journal
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Three integrated features working in concert to help you log trades faster and understand
              your performance better.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare size={28} />,
                title: "AI Trade Extraction",
                body: "Type your trade in plain English. AI extracts direction, P&L, setup, discipline score, and agency score automatically.",
              },
              {
                icon: <Activity size={28} />,
                title: "Discipline & Agency Tracking",
                body: "Track your discipline and agency scores in real-time. Identify the specific patterns that lead to your best and worst trades.",
              },
              {
                icon: <History size={28} />,
                title: "Real-Time Session Insights",
                body: "AI-powered analysis of your trading session. See your P&L time series and get actionable insights while you trade.",
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-800 bg-slate-950/50 p-10 flex flex-col gap-6 hover:border-rose-500/30 transition-colors group"
              >
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                  {icon}
                </div>
                <h3 className="text-2xl font-bold text-white">{title}</h3>
                <p className="text-slate-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sidecar Section */}
      <section className="py-28 bg-slate-900/30" id="sidecar">
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1 space-y-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-[0.2em]">
              Desktop First // Multi-Monitor Optimized
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
              Designed for the{" "}
              <span className="text-rose-400 font-serif italic">Sidecar</span>.
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Trading terminals demand screen real estate. Aurelius Ledger is optimized for vertical
              second monitors and minimal cognitive load. It sits quietly alongside your DOM or
              charts—logging trades without breaking your flow.
            </p>
            <ul className="space-y-4">
              {sidecarFeatures.map((item) => (
                <li key={item} className="flex items-center gap-3 text-slate-300">
                  <ShieldCheck className="text-rose-500 flex-shrink-0" size={20} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 w-full max-w-sm mx-auto lg:mx-0">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-2xl">
              <div className="aspect-[3/4] rounded-2xl bg-slate-950 border border-slate-800 p-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    <span>Live Trade Log</span>
                    <span className="text-rose-500">Session Active</span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                    <p className="text-sm text-slate-400 italic">
                      "Your discipline score dropped to 5/10 after three consecutive losses. Consider
                      taking a 15-minute break before your next trade."
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Agency Score
                    </span>
                    <span className="text-xs font-bold text-blue-500">Moderate</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-500 to-blue-500 w-[65%]" />
                  </div>
                  <button className="w-full text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors">
                    View Insights
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Carousel */}
      <section className="py-36 border-y border-slate-900 bg-slate-950 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-12 text-slate-800">
            <Quote size={64} fill="currentColor" />
          </div>

          <div className="relative h-52 md:h-44 flex items-center justify-center">
            {quotes.map((quote, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-700 transform ${
                  index === currentQuote
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8 pointer-events-none"
                }`}
              >
                <blockquote className="text-2xl md:text-4xl font-serif italic text-slate-200 leading-tight">
                  "{quote.text}"
                </blockquote>
                <div className="mt-8 flex flex-col items-center gap-2">
                  <span className="text-blue-500 font-bold tracking-[0.3em] uppercase text-[10px]">
                    Legendary Trader
                  </span>
                  <span className="text-rose-400/60 font-mono text-[9px] uppercase tracking-widest">
                    {quote.context}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center items-center gap-6">
            <button
              onClick={prevQuote}
              className="p-2 text-slate-600 hover:text-blue-500 transition-colors"
              aria-label="Previous quote"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-2">
              {quotes.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuote(index)}
                  aria-label={`Go to quote ${index + 1}`}
                  className={`h-1 transition-all duration-500 rounded-full ${
                    index === currentQuote ? "w-8 bg-blue-500" : "w-2 bg-slate-800 hover:bg-slate-700"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={nextQuote}
              className="p-2 text-slate-600 hover:text-blue-500 transition-colors"
              aria-label="Next quote"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[400px] bg-rose-600/5 blur-[120px] rounded-full" />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-6 tracking-tight">
            Start Trading Smarter
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            Join professional traders who use Aurelius Ledger to log trades faster, track their discipline,
            and build a lasting edge.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <input
              type="email"
              placeholder="Your email address"
              className="px-6 py-4 bg-slate-900 border border-slate-800 rounded-full focus:outline-none focus:border-blue-500 text-white w-full sm:w-80 text-sm placeholder:text-slate-600"
            />
            <button className="w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all shadow-xl shadow-blue-900/20 whitespace-nowrap">
              Get Started
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40">
              <TrendingUp size={16} className="text-slate-950" />
            </div>
            <span className="font-bold text-white tracking-tight">Aurelius Ledger</span>
          </div>
          <div className="text-slate-600 font-mono text-[10px] uppercase tracking-widest text-center">
            The AI-Powered Trading Journal.
          </div>
          <div className="flex gap-8">
            <a
              href="#"
              className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
            >
              About
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
