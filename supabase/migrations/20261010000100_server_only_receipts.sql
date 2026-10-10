-- Receipts and assistant messages are written by the server only.
--
-- record_receipt was SECURITY DEFINER and executable by any signed-in user,
-- checking only that they owned the chat. Every other field — message id,
-- hashes, tokens, cost — came from the caller, so a user could mint a receipt
-- for an answer the model never gave, and have it anchored on-chain as
-- "verified". The messages INSERT policy also let users write role='assistant'
-- rows directly. Both now go through the service role (api/chat etc.), which
-- computes the hashes itself.

drop function if exists record_receipt(
  uuid, uuid, text, text, text, text, integer, integer, numeric, text, text, text
);

create or replace function record_receipt(
  p_user_id         uuid,
  p_chat_id         uuid,
  p_message_id      uuid,
  p_provider        text,
  p_model           text,
  p_input_hash      text,
  p_output_hash     text,
  p_input_tokens    integer,
  p_output_tokens   integer,
  p_cost_credits    numeric,
  p_tee_attestation text,
  p_nonce           text,
  p_receipt_hash    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
begin
  -- The message must be an assistant answer in a chat the user owns.
  perform 1
    from messages m
    join chats c on c.id = m.chat_id
   where m.id = p_message_id
     and m.chat_id = p_chat_id
     and m.role = 'assistant'
     and c.user_id = p_user_id;
  if not found then
    raise exception 'Message not found or unauthorized';
  end if;

  insert into inference_receipts (
    user_id, chat_id, message_id, provider, model,
    input_hash, output_hash, input_tokens, output_tokens, cost_credits,
    tee_attestation, nonce, receipt_hash
  )
  values (
    p_user_id, p_chat_id, p_message_id, p_provider, p_model,
    p_input_hash, p_output_hash, p_input_tokens, p_output_tokens, p_cost_credits,
    p_tee_attestation, p_nonce, p_receipt_hash
  )
  returning id into v_receipt_id;

  return v_receipt_id;
end;
$$;

revoke execute on function record_receipt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, numeric, text, text, text
) from public, anon, authenticated;
grant execute on function record_receipt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, numeric, text, text, text
) to service_role;

-- Users may only insert their own (user-role) messages.
drop policy if exists "Users can insert messages in own chats" on messages;
create policy "Users can insert user messages in own chats"
  on messages for insert
  with check (
    role = 'user'
    and exists (
      select 1 from chats
       where chats.id = messages.chat_id
         and chats.user_id = auth.uid()
    )
  );
