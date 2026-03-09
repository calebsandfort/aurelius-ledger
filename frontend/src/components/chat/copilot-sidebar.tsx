"use client"

import { CopilotSidebar as CopilotSidebarUI } from "@copilotkit/react-ui"
import "@copilotkit/react-ui/styles.css"

export function CopilotSidebar() {
  return (
    <div className="h-full w-full bg-slate-950">
      <CopilotSidebarUI
        className="h-full"
        labels={{
          title: "AI Assistant",
          initial: "Hi! How can I help you today?",
        }}
      />
    </div>
  )
}
