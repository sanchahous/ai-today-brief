-- Fix the llm-api-adapter example in the "pitfalls of OpenAI-compatible APIs" article.
-- The old snippet used AdapterClient / provider="gemini", which the library does not have.
-- Corrected per https://github.com/Inozem/llm_api_adapter (UniversalLLMAPIAdapter, organization="google", api_key, reasoning_level).
-- Also adds a link to the GitHub repository in both language bodies.
-- Idempotent: keyed by slug; the body append is guarded so re-running does not duplicate the link line.

update public.brief_items
set
  code_snippet = jsonb_build_object(
    'language', 'python',
    'code', $code$import os

from llm_api_adapter.models.messages.chat_message import UserMessage
from llm_api_adapter.universal_adapter import UniversalLLMAPIAdapter

adapter = UniversalLLMAPIAdapter(
    organization="google",
    model="gemini-3.6-flash",
    api_key=os.environ["GOOGLE_API_KEY"],
)

response = adapter.chat(
    messages=[UserMessage("Solve this architecture bottleneck.")],
    reasoning_level="high",
)
print(response.content)$code$
  ),
  body_md_en = case
    when body_md_en like '%github.com/Inozem/llm_api_adapter%' then body_md_en
    else body_md_en || E'\n\nWorking examples: [llm_api_adapter on GitHub](https://github.com/Inozem/llm_api_adapter)'
  end,
  body_md_uk = case
    when body_md_uk like '%github.com/Inozem/llm_api_adapter%' then body_md_uk
    else body_md_uk || E'\n\nРобочі приклади: [llm_api_adapter на GitHub](https://github.com/Inozem/llm_api_adapter)'
  end
where slug = 'pitfalls-of-openai-compatible-apis-what-breaks-across-multi-provider-llm-deploym';
