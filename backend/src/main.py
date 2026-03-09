import warnings

# Suppress Pydantic UnsupportedFieldAttributeWarning from ag-ui-protocol package.
# The `forwarded_props` field in RunAgentInput gets a `validation_alias` of
# `forwardedProps` via the to_camel alias generator, which Pydantic warns about
# when processing union/discriminator schemas. This is a known upstream issue with
# no functional impact.
warnings.filterwarnings(
    "ignore",
    message=".*forwardedProps.*",
    category=UserWarning,
    module="pydantic.*",
)

from dotenv import load_dotenv

load_dotenv()

from ag_ui_langgraph import add_langgraph_fastapi_endpoint  # noqa: E402
from copilotkit import LangGraphAGUIAgent  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from src.agent.graph import agent  # noqa: E402
from src.api.router import api_router  # noqa: E402
from src.config import settings  # noqa: E402

app = FastAPI(title="Aurelius Ledger API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

copilot_agent = LangGraphAGUIAgent(
    name="chat_agent",
    description="A helpful AI chat assistant.",
    graph=agent,
)

add_langgraph_fastapi_endpoint(app, copilot_agent, "/copilotkit")
