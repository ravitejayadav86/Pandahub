"use client";

export default function GeneratedPage() {
  return (
    <main className="min-h-screen text-on-surface bg-background font-body">


<header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl border-b border-white/10 backdrop-saturate-150 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] font-headline text-body font-medium tracking-tight">
<div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">

<div className="flex items-center gap-2 text-xl font-bold tracking-tighter text-on-surface bg-clip-text hover:bg-white/5 hover:backdrop-blur-md transition-all duration-300 rounded-lg px-3 py-1 cursor-pointer">
<span className="material-symbols-outlined text-primary-container" style={{fontVariationSettings: ''FILL' 1'}}>cloud_sync</span>
<span>PandaHub</span>
</div>

<nav className="hidden md:flex items-center gap-8">
<a className="text-primary font-semibold border-b-2 border-primary pb-1 Active:scale-95 transition-transform duration-200 ease-out" href="#">Product</a>
<a className="text-on-surface-variant hover:text-on-surface transition-colors duration-300 hover:bg-white/5 hover:backdrop-blur-md px-3 py-1 rounded-lg" href="#">Solutions</a>
<a className="text-on-surface-variant hover:text-on-surface transition-colors duration-300 hover:bg-white/5 hover:backdrop-blur-md px-3 py-1 rounded-lg" href="#">Open Source</a>
<a className="text-on-surface-variant hover:text-on-surface transition-colors duration-300 hover:bg-white/5 hover:backdrop-blur-md px-3 py-1 rounded-lg" href="#">Pricing</a>
</nav>

<div className="flex items-center gap-4">
<a className="hidden md:block text-on-surface hover:text-primary transition-colors text-sm font-semibold hover:bg-white/5 hover:backdrop-blur-md px-3 py-1.5 rounded-lg" href="#">Sign In</a>
<button className="bg-primary-container text-on-primary-container px-5 py-2 rounded-lg font-bold text-sm tracking-wide btn-glow hover:bg-primary-container/90 Active:scale-95 transition-all duration-200 ease-out">Get Started</button>
</div>
</div>
</header>
<main className="flex-grow flex flex-col items-center justify-center pt-32 pb-20 px-6 max-w-7xl mx-auto w-full relative z-10">

<section className="text-center w-full max-w-4xl mx-auto flex flex-col items-center justify-center mb-24 animate-fade-in-up">
<h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-on-surface mb-6 leading-tight drop-shadow-2xl font-display">
                Code hosting for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-container to-tertiary-container">next generation.</span>
</h1>
<p className="text-xl md:text-2xl text-on-surface-variant mb-10 max-w-2xl font-medium leading-relaxed">
                Collaborate, build, and ship with PandaHub. The definitive platform for modern developer teams.
            </p>
<div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
<button className="bg-primary-container text-on-primary-container px-8 py-4 rounded-xl font-bold text-lg tracking-wide btn-glow hover:bg-primary-container/90 active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-2 group">
                    Get Started
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
</button>
<button className="glass-panel text-on-surface px-8 py-4 rounded-xl font-bold text-lg tracking-wide hover:bg-white/10 active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-2 border border-outline-variant/30">
<span className="material-symbols-outlined">terminal</span>
                    View Documentation
                </button>
</div>
</section>

<section className="w-full max-w-5xl mx-auto mb-32 group perspective">
<div className="glass-panel rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform transition-transform duration-700 hover:scale-[1.02] hover:shadow-[0_30px_60px_rgba(62,144,255,0.2)] border border-white/10">

<div className="bg-surface-container-highest/80 backdrop-blur-md px-4 py-3 flex items-center gap-4 border-b border-white/5">
<div className="flex gap-2">
<div className="w-3 h-3 rounded-full bg-error"></div>
<div className="w-3 h-3 rounded-full bg-tertiary"></div>
<div className="w-3 h-3 rounded-full bg-primary-container"></div>
</div>
<div className="flex-grow flex justify-center">
<div className="bg-surface-dim/50 px-4 py-1 rounded-md text-xs text-outline-variant font-mono flex items-center gap-2">
<span className="material-symbols-outlined text-[14px]">lock</span>
                            main.py — PandaHub
                        </div>
</div>
</div>

<div className="p-6 md:p-8 bg-surface-container-lowest/90 font-mono text-sm md:text-base overflow-x-auto">
<pre className="text-on-surface-variant"><code className="language-python"><span className="text-tertiary-container">import</span> asyncio
<span className="text-tertiary-container">from</span> pandahub <span className="text-tertiary-container">import</span> Client, Repository

<span className="text-outline"># Initialize the advanced liquid glass client</span>
<span className="text-primary">async def</span> <span className="text-tertiary">deploy_next_gen_app</span>():
    client = Client(api_key=<span className="text-error">"pd_live_..."</span>)
    
    <span className="text-outline"># Seamless code collaboration</span>
    repo = <span className="text-tertiary-container">await</span> client.get_repository(<span className="text-error">"core-engine"</span>)
    
    <span className="text-tertiary-container">if</span> repo.status == <span className="text-error">"ready"</span>:
        <span className="text-outline"># Deploying at lightspeed</span>
        deployment = <span className="text-tertiary-container">await</span> repo.deploy(
            environment=<span className="text-error">"production"</span>,
            strategy=<span className="text-error">"blue-green"</span>
        )
        <span className="text-primary">print</span>(<span className="text-error">f"Deployment successful: </span><span className="text-primary-container">&#123;</span>deployment.url<span className="text-primary-container">&#125;</span><span className="text-error">"</span>)

<span className="text-tertiary-container">if</span> __name__ == <span className="text-error">"__main__"</span>:
    asyncio.run(deploy_next_gen_app())</code></pre>
</div>
</div>
</section>

<section className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">

<div className="glass-panel p-8 rounded-2xl flex flex-col gap-4 hover:-translate-y-2 transition-transform duration-300 group">
<div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary-container group-hover:scale-110 group-hover:bg-primary-container/30 transition-all">
<span className="material-symbols-outlined" style={{fontVariationSettings: ''FILL' 1'}}>rate_review</span>
</div>
<h3 className="text-xl font-bold text-on-surface font-headline">Code Review</h3>
<p className="text-on-surface-variant leading-relaxed">Frictionless inline commenting and AI-assisted PR summaries built right into the editor view.</p>
</div>

<div className="glass-panel p-8 rounded-2xl flex flex-col gap-4 hover:-translate-y-2 transition-transform duration-300 group">
<div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary-container group-hover:scale-110 group-hover:bg-tertiary-container/30 transition-all">
<span className="material-symbols-outlined" style={{fontVariationSettings: ''FILL' 1'}}>rocket_launch</span>
</div>
<h3 className="text-xl font-bold text-on-surface font-headline">CI/CD</h3>
<p className="text-on-surface-variant leading-relaxed">Integrated workflows that build, test, and deploy faster than ever with automated caching.</p>
</div>

<div className="glass-panel p-8 rounded-2xl flex flex-col gap-4 hover:-translate-y-2 transition-transform duration-300 group">
<div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center text-error group-hover:scale-110 group-hover:bg-error/30 transition-all">
<span className="material-symbols-outlined" style={{fontVariationSettings: ''FILL' 1'}}>bug_report</span>
</div>
<h3 className="text-xl font-bold text-on-surface font-headline">Issue Tracking</h3>
<p className="text-on-surface-variant leading-relaxed">Powerful boards and sprint planning tools that map directly to your commits and branches.</p>
</div>
</section>
</main>

<footer className="w-full relative bottom-0 bg-surface-container-lowest border-t border-outline-variant/30 font-label text-sm uppercase tracking-widest text-primary">
<div className="flex flex-col md:flex-row justify-between items-center py-12 px-8 max-w-7xl mx-auto gap-6">

<div className="text-lg font-black text-on-surface flex items-center gap-2">
<span className="material-symbols-outlined text-primary-container" style={{fontVariationSettings: ''FILL' 1'}}>cloud_sync</span>
                PandaHub
            </div>

<nav className="flex flex-wrap justify-center gap-6">
<a className="text-outline hover:text-on-surface transition-colors duration-300 hover:opacity-80 hover:underline decoration-primary underline-offset-4" href="#">Security</a>
<a className="text-outline hover:text-on-surface transition-colors duration-300 hover:opacity-80 hover:underline decoration-primary underline-offset-4" href="#">Privacy</a>
<a className="text-outline hover:text-on-surface transition-colors duration-300 hover:opacity-80 hover:underline decoration-primary underline-offset-4" href="#">Terms</a>
<a className="text-outline hover:text-on-surface transition-colors duration-300 hover:opacity-80 hover:underline decoration-primary underline-offset-4" href="#">Docs</a>
<a className="text-outline hover:text-on-surface transition-colors duration-300 hover:opacity-80 hover:underline decoration-primary underline-offset-4" href="#">Status</a>
</nav>

<div className="text-outline text-xs">
                © 2027 PandaHub, Inc. Liquid Glass Edition.
            </div>
</div>
</footer>


    </main>
  );
}