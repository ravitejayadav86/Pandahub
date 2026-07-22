import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Checkbox } from "@/components/ui/Checkbox"
import { Switch } from "@/components/ui/Switch"
import { Badge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs } from "@/components/ui/Tabs"
import { Skeleton } from "@/components/ui/Skeleton"
import { Tooltip } from "@/components/ui/Tooltip"

export const metadata = {
  title: "Design System | PandaHub",
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen p-12 max-w-5xl mx-auto space-y-16">
      
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gradient inline-block">Design System</h1>
        <p className="text-slate-500">Component library built with custom Vanilla CSS & React.</p>
      </div>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Buttons</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary Glow</Button>
          <Button variant="glass">Glass Button</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost Style</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="icon">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Button>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Cards & Glassmorphism</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card variant="glass-panel" interactive="lift">
            <CardHeader>
              <CardTitle>Glass Panel (Lift Interactive)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 mb-4">
                This is a heavy glassmorphism panel. It lifts and casts a deep shadow on hover.
              </p>
              <Skeleton className="w-full h-24" />
            </CardContent>
          </Card>

          <Card variant="glass-card" interactive="glow">
            <CardHeader>
              <CardTitle>Glass Card (Glow Interactive)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 mb-4">
                Lighter blur, and glows with the primary color when you hover over it.
              </p>
              <div className="space-y-2">
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-3/4 h-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Forms & Inputs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
          <div className="space-y-6">
            <Input label="Email Address" type="email" placeholder="john@example.com" />
            <Input label="Password" type="password" placeholder="••••••••" required />
            <Input label="Error State" error="This field is required." />
          </div>
          <div className="space-y-6">
            <Checkbox label="Remember me" description="Keep me logged in on this device." />
            <Checkbox label="Subscribe to newsletter" />
            
            <div className="pt-4 border-t">
              <Switch label="Enable Notifications" description="Receive email alerts for new PRs." />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Badges & Tooltips</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Badge variant="blue">Active</Badge>
          <Badge variant="green">Success</Badge>
          <Badge variant="purple">Enhancement</Badge>
          <Badge variant="amber">Pending</Badge>
          <Badge variant="red">Failed</Badge>
          <Badge variant="default">Default</Badge>

          <div className="ml-8 border-l pl-8">
            <Tooltip content="This is a gorgeous native tooltip!">
              <span className="text-sm font-medium text-slate-600 underline decoration-dashed cursor-help">Hover me for tooltip</span>
            </Tooltip>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Avatars</h2>
        <div className="flex gap-4 items-center">
          <Avatar size="sm" alt="John Doe" />
          <Avatar size="md" alt="Jane Smith" />
          <Avatar size="lg" src="https://github.com/shadcn.png" alt="Shadcn" />
          <Avatar size="xl" alt="Panda Hub" />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Tabs</h2>
        <div className="max-w-md">
          <Tabs 
            tabs={[
              { id: "code", label: "Code", content: <p className="text-sm text-slate-600">Code repository view goes here.</p> },
              { id: "issues", label: "Issues", content: <p className="text-sm text-slate-600">Issue tracker goes here.</p> },
              { id: "prs", label: "Pull Requests", content: <p className="text-sm text-slate-600">PR list goes here.</p> }
            ]}
          />
        </div>
      </section>

    </div>
  )
}
