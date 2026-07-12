"use client";

export default function GeneratedPage() {
  return (
    <main className="min-h-screen text-on-surface bg-background font-body">


<header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-6 max-w-7xl mx-auto left-0 right-0">
<a className="flex items-center gap-2 group" href="/explore">
<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-container to-inverse-primary flex items-center justify-center text-on-primary-container shadow-[0_0_15px_rgba(10,132,255,0.3)]">
<span className="material-symbols-outlined text-lg" style={{fontVariationSettings: '"FILL" 1'}}>widgets</span>
</div>
<span className="text-xl font-bold tracking-tighter text-on-surface">PandaHub</span>
</a>
</header>

<div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
<div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary-container/20 blur-[120px] mix-blend-screen orb-1"></div>
<div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-secondary-container/20 blur-[150px] mix-blend-screen orb-2"></div>
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-tertiary-container/10 blur-[100px] mix-blend-screen orb-3"></div>
</div>

<main className="relative z-10 flex items-center justify-center min-h-screen px-4 py-24">

<div className="w-full max-w-md glass-panel rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)] transform transition-all duration-500 ease-out">

<div className="flex border-b border-white/10 w-full relative">

<div className="absolute bottom-0 left-0 w-1/2 h-[2px] bg-[#0A84FF] shadow-[0_-2px_10px_rgba(10,132,255,0.5)] transition-transform duration-300 ease-out" id="tabIndicator"></div>
<button className="flex-1 py-5 text-sm font-semibold tracking-wide text-on-surface transition-colors duration-300" id="tabSignIn" onClick={() => {}} data-onclick="switchTab(0)">
                    Sign In
                </button>
<button className="flex-1 py-5 text-sm font-medium tracking-wide text-on-surface-variant hover:text-on-surface transition-colors duration-300" id="tabCreate" onClick={() => {}} data-onclick="switchTab(1)">
                    Create Account
                </button>
</div>
<div className="p-8 sm:p-10">
<div className="mb-8 text-center">
<h1 className="text-3xl font-display font-bold tracking-tight text-on-surface mb-2">Welcome back</h1>
<p className="text-on-surface-variant text-sm font-label">Enter your details to access your workspace.</p>
</div>

<form className="space-y-5" onSubmit={(e) => e.preventDefault()} data-onsubmit="event.preventDefault();">
<div className="space-y-1">
<label className="block text-xs font-medium text-on-surface-variant font-label tracking-wide ml-1" htmlFor="email">Email</label>
<div className="relative">
<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
<span className="material-symbols-outlined text-[20px]">mail</span>
</div>
<input className="block w-full pl-11 pr-4 py-3.5 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 sm:text-sm glow-accent-focus" id="email" placeholder="name@company.com" type="email"/>
</div>
</div>
<div className="space-y-1">
<div className="flex items-center justify-between ml-1">
<label className="block text-xs font-medium text-on-surface-variant font-label tracking-wide" htmlFor="password">Password</label>
<a className="text-xs font-medium text-primary hover:text-primary-fixed transition-colors" href="/explore">Forgot password?</a>
</div>
<div className="relative">
<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
<span className="material-symbols-outlined text-[20px]">lock</span>
</div>
<input className="block w-full pl-11 pr-10 py-3.5 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 sm:text-sm glow-accent-focus" id="password" placeholder="••••••••" type="password"/>
<button className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-on-surface transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">visibility_off</span>
</button>
</div>
</div>
<button className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#0A84FF] hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A84FF] focus:ring-offset-background transition-all duration-200 active:scale-[0.98] glow-accent mt-8" type="submit">
                        Sign In
                    </button>
</form>
<div className="mt-8">
<div className="relative">
<div className="absolute inset-0 flex items-center">
<div className="w-full border-t border-white/10"></div>
</div>
<div className="relative flex justify-center text-xs">
<span className="px-3 bg-transparent text-outline font-label backdrop-blur-sm">Or continue with</span>
</div>
</div>
<div className="mt-6 grid grid-cols-2 gap-4">
<button className="flex justify-center items-center py-3 px-4 input-glass rounded-xl hover:bg-white/5 transition-all active:scale-95 group">
<svg aria-hidden="true" className="h-5 w-5 text-on-surface group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
<path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd"></path>
</svg>
</button>
<button className="flex justify-center items-center py-3 px-4 input-glass rounded-xl hover:bg-white/5 transition-all active:scale-95 group">
<svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
<path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"></path>
<path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"></path>
<path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"></path>
<path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"></path>
</svg>
</button>
</div>
</div>
</div>
</div>
</main>


    </main>
  );
}