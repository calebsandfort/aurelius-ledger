import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph"
import { NextRequest } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000"

const chat_agent = new LangGraphHttpAgent({
  url: `${BACKEND_URL}/copilotkit`,
})

const runtime = new CopilotRuntime({
  agents: {
    chat_agent,
  } as any,
})

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  })
  return handleRequest(req)
}
