import Link from "next/link";
import Image from "next/image";
import {
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  Clock,
  ArrowRight,
  Building2,
  Globe,
  Mail,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Repeat,
  Send,
  Store,
  UserSearch,
  Users,
  Zap,
  LineChart,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-xl font-extrabold tracking-tight ${className}`}
    >
      <span className="brand-gradient bg-clip-text text-transparent">
        NOTIFIN
      </span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden bg-nf-bg text-nf-on-surface font-display selection:bg-nf-secondary-container selection:text-nf-on-secondary-container">
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="flex justify-between items-center w-full px-4 md:px-12 py-4 max-w-screen-2xl mx-auto h-20">
          <Link href="/">
            <Logo />
          </Link>
          <div className="hidden md:flex items-center gap-10">
            <a
              className="text-nf-on-surface-variant font-medium text-base hover:text-nf-secondary transition-colors"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-nf-on-surface-variant font-medium text-base hover:text-nf-secondary transition-colors"
              href="#solutions"
            >
              Solutions
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-nf-on-surface font-semibold text-sm hover:text-nf-primary transition-colors px-4"
            >
              Log In
            </Link>
            <Link
              href="/login"
              className="brand-gradient text-white px-6 py-2.5 rounded-lg font-bold text-sm active:scale-95 transition-all shadow-lg shadow-nf-primary-container/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center overflow-hidden px-4 md:px-12 pt-20">
          <div className="ambient-orb orb-1 animate-pulse" />
          <div className="ambient-orb orb-2" />
          <div className="relative z-10 max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-white/10 text-nf-secondary w-fit">
                <BellRing size={18} />
                <span className="text-sm tracking-wider font-bold">
                  ALL-IN-ONE NOTIFICATION MANAGER
                </span>
              </div>
              <h1 className="font-display text-5xl md:text-6xl leading-[1.1] hero-title-text">
                Manage Users &amp;{" "}
                <span className="brand-gradient bg-clip-text text-transparent">
                  Schedule Alerts
                </span>{" "}
                with Ease
              </h1>
              <p className="text-lg text-nf-on-surface-variant/80 max-w-lg leading-relaxed">
                The modern standard for automated customer notifications. Easily
                schedule alerts, manage recipients, and deliver via WhatsApp and
                Email from one intuitive dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 pt-2">
                <Link
                  href="/login"
                  className="brand-gradient text-white px-16 py-4 rounded-xl font-bold text-2xl shadow-xl shadow-nf-primary-container/30 hover:scale-[1.02] transition-all text-center"
                >
                  Start Managing Now
                </Link>
                <Link
                  href="/login"
                  className="bg-white/5 backdrop-blur-md border border-white/10 px-16 py-4 rounded-xl font-bold text-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 group"
                >
                  <span className="group-hover:text-nf-secondary transition-colors">
                    <LineChart size={24} />
                  </span>
                  View Dashboard
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-8">
                <div className="text-xs uppercase tracking-[0.2em] text-nf-outline/60 font-bold">
                  Trusted by Growing Brands
                </div>
                <div className="flex gap-6 items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-80 transition-all cursor-default">
                  <Store size={36} />
                  <Users size={36} />
                  <Clock size={36} />
                </div>
              </div>
            </div>

            {/* Enhanced Bento UI */}
            <div className="hidden lg:grid grid-cols-6 grid-rows-6 gap-4 h-[560px]">
              <div className="col-span-4 row-span-4 glass-panel rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative group">
                <div className="flex justify-between items-center z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-nf-secondary animate-pulse" />
                    <span className="text-sm text-nf-secondary font-bold tracking-widest uppercase">
                      Upcoming Scheduled Alerts
                    </span>
                  </div>
                  <CalendarClock
                    size={20}
                    className="text-nf-secondary bg-nf-secondary/10 p-1 box-content rounded-lg"
                  />
                </div>
                <div className="space-y-4 z-10">
                  <div className="h-12 glass-panel rounded-xl flex items-center px-4 gap-3 border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-nf-secondary/20 flex items-center justify-center text-nf-secondary">
                      <Mail size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/90 font-bold">
                        Weekly Newsletter
                      </span>
                      <span className="text-[8px] text-white/50">
                        Sept 24, 10:00 AM
                      </span>
                    </div>
                    <span className="text-[10px] text-nf-secondary font-mono ml-auto">
                      READY
                    </span>
                  </div>
                  <div className="h-12 glass-panel rounded-xl flex items-center px-4 gap-3 border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-nf-primary/20 flex items-center justify-center text-nf-primary">
                      <MessageSquare size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/90 font-bold">
                        Promotion Alert
                      </span>
                      <span className="text-[8px] text-white/50">
                        Tomorrow, 2:00 PM
                      </span>
                    </div>
                    <span className="text-[10px] text-nf-primary font-mono ml-auto">
                      SCHEDULED
                    </span>
                  </div>
                </div>
                <div
                  className="absolute inset-0 opacity-40 group-hover:scale-110 transition-transform duration-700 pointer-events-none bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url(https://lh3.googleusercontent.com/aida-public/AB6AXuClbqxxsuzObjJWdvmwdS5n7CuMytRpLLOc99qnhC0J7fMRhelW_gAxIIDK0_vYBOmq-adkXpB1MUCcZN6zqdznsbzRycvCH_yk8AZWPKs60NSBjgyyQYfbLg2RgsQuaJcnTvG0erD4M_-1yHQkblz48VbPPZjgie7LC5hz9rO0vOOxAQfv6YBisRNTr8HHqF49HPnIKfH06oQA0iY0-lR-zGA5pn8Vypv6fOwDl5JsCzktg7viRrCP)",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-nf-bg-low to-transparent" />
              </div>

              <div className="col-span-2 row-span-3 brand-gradient rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 shadow-2xl shadow-nf-primary/20">
                <CheckCheck size={48} className="text-white mb-2" />
                <div className="text-4xl text-white font-black">100%</div>
                <div className="text-sm text-white/80 uppercase tracking-widest font-bold">
                  Delivery Rate
                </div>
              </div>

              <div className="col-span-2 row-span-3 glass-panel rounded-3xl p-6 border-white/10 flex flex-col justify-between items-center text-center py-8">
                <div className="p-3 bg-nf-primary/10 rounded-2xl">
                  <CalendarDays size={28} className="text-nf-primary" />
                </div>
                <div className="font-bold tracking-widest uppercase text-white/80">
                  Smart Scheduling
                </div>
              </div>

              <div className="col-span-4 row-span-2 glass-panel rounded-3xl border-white/10 p-4 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    <div className="w-10 h-10 rounded-full border-2 border-nf-bg bg-slate-700 ring-2 ring-white/5" />
                    <div className="w-10 h-10 rounded-full border-2 border-nf-bg bg-slate-600 ring-2 ring-white/5" />
                    <div className="w-10 h-10 rounded-full border-2 border-nf-bg bg-slate-500 ring-2 ring-white/5" />
                  </div>
                  <div className="text-sm text-nf-on-surface-variant font-semibold">
                    Join 4,500+ Active Users
                  </div>
                </div>
                <ArrowRight size={20} className="text-nf-outline-variant" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          className="py-16 px-4 md:px-12 bg-nf-bg-lowest"
          id="features"
        >
          <div className="max-w-screen-2xl mx-auto">
            <Reveal>
              <div className="text-center mb-16">
                <h2 className="text-4xl mb-4 text-white font-extrabold">
                  Full-Featured Management
                </h2>
                <p className="text-lg text-nf-on-surface-variant max-w-2xl mx-auto">
                  Everything you need to automate your communications without
                  touching a single line of code.
                </p>
              </div>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
              <Reveal>
                <div className="p-8 rounded-[2.5rem] glass-panel border-white/5 hover:border-nf-secondary/30 transition-all duration-500 group relative overflow-hidden flex flex-col h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-nf-secondary/5 blur-3xl rounded-full" />
                  <div className="w-16 h-16 rounded-2xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary mb-6 group-hover:scale-110 group-hover:bg-nf-secondary/20 transition-all">
                    <Users size={28} />
                  </div>
                  <h3 className="text-2xl mb-4 text-white font-bold">
                    User Management
                  </h3>
                  <p className="text-base leading-relaxed mb-6 text-nf-on-surface-variant">
                    Add and manage your notification recipients easily. Create
                    custom segments and groups to ensure the right message
                    always reaches the right people.
                  </p>
                </div>
              </Reveal>
              <Reveal>
                <div className="p-8 rounded-[2.5rem] glass-panel border-white/5 hover:border-nf-primary/30 transition-all duration-500 group relative overflow-hidden flex flex-col h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-nf-primary/5 blur-3xl rounded-full" />
                  <div className="w-16 h-16 rounded-2xl bg-nf-primary/10 flex items-center justify-center text-nf-primary mb-6 group-hover:scale-110 group-hover:bg-nf-primary/20 transition-all">
                    <CalendarClock size={28} />
                  </div>
                  <h3 className="text-2xl mb-4 text-white font-bold">
                    Smart Scheduling
                  </h3>
                  <p className="text-base leading-relaxed mb-6 text-nf-on-surface-variant">
                    Set the exact time and date for automated alerts. Whether
                    it&apos;s a one-time reminder or a recurring broadcast, we
                    handle the timing perfectly.
                  </p>
                </div>
              </Reveal>
              <Reveal>
                <div className="p-8 rounded-[2.5rem] glass-panel border-white/5 hover:border-nf-secondary/30 transition-all duration-500 group relative overflow-hidden flex flex-col h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-nf-secondary/5 blur-3xl rounded-full" />
                  <div className="w-16 h-16 rounded-2xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary mb-6 group-hover:scale-110 group-hover:bg-nf-secondary/20 transition-all">
                    <Repeat size={28} />
                  </div>
                  <h3 className="text-2xl mb-4 text-white font-bold">
                    Multi-Channel Delivery
                  </h3>
                  <p className="text-base leading-relaxed mb-6 text-nf-on-surface-variant">
                    Reliable delivery via WhatsApp and Email. Reach your
                    customers where they are most active with high-performance
                    cross-channel automation.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="py-16 px-4 md:px-12">
          <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <Reveal>
              <div className="stat-card rounded-3xl p-6 flex flex-col gap-6 relative group hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary">
                    <Send size={24} />
                  </div>
                  <div className="text-[10px] font-bold tracking-widest text-nf-secondary uppercase bg-nf-secondary/5 px-2 py-1 rounded">
                    Volume
                  </div>
                </div>
                <div>
                  <div className="text-5xl font-black text-white mb-1">
                    500M+
                  </div>
                  <div className="text-nf-on-surface-variant font-bold text-sm uppercase tracking-wider">
                    Messages Delivered
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal>
              <div className="stat-card rounded-3xl p-6 flex flex-col gap-6 relative group hover:-translate-y-1 transition-transform border-nf-primary/20 bg-nf-primary/5">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-xl bg-nf-primary/10 flex items-center justify-center text-nf-primary">
                    <Zap size={24} />
                  </div>
                  <div className="text-[10px] font-bold tracking-widest text-nf-primary uppercase bg-nf-primary/5 px-2 py-1 rounded">
                    Automation
                  </div>
                </div>
                <div>
                  <div className="text-5xl font-black text-white mb-1">
                    Instant
                  </div>
                  <div className="text-nf-on-surface-variant font-bold text-sm uppercase tracking-wider">
                    Trigger Speed
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal>
              <div className="stat-card rounded-3xl p-6 flex flex-col gap-6 relative group hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary">
                    <Building2 size={24} />
                  </div>
                  <div className="text-[10px] font-bold tracking-widest text-nf-secondary uppercase bg-nf-secondary/5 px-2 py-1 rounded">
                    Scale
                  </div>
                </div>
                <div>
                  <div className="text-5xl font-black text-white mb-1">
                    12k+
                  </div>
                  <div className="text-nf-on-surface-variant font-bold text-sm uppercase tracking-wider">
                    Happy Organizations
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Visual Dashboard Section */}
        <section className="py-16 px-4 md:px-12 bg-nf-bg-low/30" id="solutions">
          <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div className="relative group">
                <div className="absolute -top-10 -left-10 w-40 h-40 brand-gradient rounded-full blur-[100px] opacity-20" />
                <div className="glass-panel rounded-[2.5rem] p-4 border-white/10 shadow-2xl shadow-nf-primary/10 overflow-hidden relative z-10">
                  <Image
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBF5YPDYQ_Yd6VPrgzuj9lSGmuEeJCMgB-6JvFkvyfmSwvh2K1BjK_eWygF8msR4uhJwiFDvuj1hbSTlKQo_bGKXG7sgviNMTYHWD2LdLPmXjyIc01_SN_ka4e59go49xsoHD2fxB9aGiQL4TBR-sP8yqkAKFgvPFBVc9j3w05YXgCxilfzjVr29DfhVXDCNZ0tb2aUjClL1dPn6A0CYIfmqamEbRJ355uDnSoMLJBVRJW8KgSkJM0c"
                    alt="Intuitive notification management dashboard mockup"
                    width={1600}
                    height={1000}
                    className="w-full h-auto rounded-3xl shadow-2xl"
                  />
                </div>
              </div>
            </Reveal>
            <div className="flex flex-col gap-6">
              <h2 className="text-4xl text-white font-extrabold leading-tight">
                Your Control Center for{" "}
                <br />
                <span className="text-nf-secondary">Customer Engagement</span>
              </h2>
              <div className="space-y-6 pt-4">
                <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary shrink-0 group-hover:bg-nf-secondary group-hover:text-nf-bg transition-all duration-300 shadow-lg shadow-nf-secondary/5">
                    <CalendarRange size={24} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-white text-2xl">
                      Visual Scheduler
                    </h4>
                    <p className="text-base text-nf-on-surface-variant/80 leading-relaxed">
                      Plan your entire month of communications in minutes with
                      our drag-and-drop calendar interface.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary shrink-0 group-hover:bg-nf-secondary group-hover:text-nf-bg transition-all duration-300 shadow-lg shadow-nf-secondary/5">
                    <UserSearch size={24} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-white text-2xl">
                      Advanced User Filtering
                    </h4>
                    <p className="text-base text-nf-on-surface-variant/80 leading-relaxed">
                      Target specific segments based on behavior, location, or
                      custom tags for maximum impact.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-nf-secondary/10 flex items-center justify-center text-nf-secondary shrink-0 group-hover:bg-nf-secondary group-hover:text-nf-bg transition-all duration-300 shadow-lg shadow-nf-secondary/5">
                    <LineChart size={24} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-white text-2xl">
                      Real-time Insights
                    </h4>
                    <p className="text-base text-nf-on-surface-variant/80 leading-relaxed">
                      Track open rates, click-throughs, and delivery status
                      live as your notifications go out.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 px-4 md:px-12 overflow-hidden relative">
          <div className="absolute inset-0 brand-gradient opacity-10 blur-[120px]" />
          <Reveal>
            <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center gap-6 py-6">
              <h2 className="text-5xl text-white font-black leading-tight">
                Ready to streamline your <br />
                customer notifications?
              </h2>
              <p className="text-lg text-nf-on-surface-variant max-w-xl font-medium">
                No hidden fees, no technical setup required. Experience the
                future of automated notification management.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 pt-4">
                <Link
                  href="/login"
                  className="bg-white text-nf-bg px-16 py-5 rounded-2xl font-black text-2xl hover:shadow-2xl hover:shadow-white/20 hover:-translate-y-1 transition-all"
                >
                  Create Free Account
                </Link>
                <a
                  href="/login"
                  className="glass-panel text-white px-16 py-5 rounded-2xl font-black text-2xl border-white/20 hover:bg-white/10 transition-all"
                >
                  Speak with an Expert
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="bg-nf-bg-lowest border-t border-white/5">
        <div className="w-full px-4 md:px-12 py-16 max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="mb-4">
              <Logo />
            </div>
            <p className="text-nf-on-surface-variant font-medium text-base text-center md:text-left max-w-xs opacity-60">
              © 2026 NOTIFIN Platform. Precision notification management for
              modern brands.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-10">
            <a
              className="text-nf-on-surface-variant/80 font-bold text-sm hover:text-white transition-colors"
              href="#"
            >
              Privacy
            </a>
            <a
              className="text-nf-on-surface-variant/80 font-bold text-sm hover:text-white transition-colors"
              href="#"
            >
              Terms
            </a>
            <a
              className="text-nf-on-surface-variant/80 font-bold text-sm hover:text-white transition-colors"
              href="#"
            >
              Contact
            </a>
            <a
              className="text-nf-on-surface-variant font-bold text-sm flex items-center gap-2"
              href="#"
            >
              <div className="w-2 h-2 rounded-full bg-nf-secondary animate-pulse" />
              All Systems Operational
            </a>
          </div>
          <div className="flex gap-4">
            <a
              className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white hover:border-nf-secondary transition-all"
              href="#"
            >
              <Globe size={20} />
            </a>
            <a
              className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white hover:border-nf-secondary transition-all"
              href="#"
            >
              <Megaphone size={20} />
            </a>
            <a
              className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white hover:border-nf-secondary transition-all"
              href="#"
            >
              <MessagesSquare size={20} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
