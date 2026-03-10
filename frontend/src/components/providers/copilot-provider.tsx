"use client"

import { CopilotKit } from "@copilotkit/react-core"
import { useCoAgent } from "@copilotkit/react-core"
import { useAuth } from "@/hooks/use-auth"

function AgentStateSync() {
  const { user } = useAuth()
  useCoAgent({
    name: "chat_agent",
    initialState: { user_id: user?.id ?? null },
  })
  return null
}

interface CopilotProviderProps {
  children: React.ReactNode
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="chat_agent">
      <AgentStateSync />
      {children}
    </CopilotKit>
  )
}
