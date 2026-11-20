import { useState } from "react";
import { Button, Dialog } from "./primitives";

export interface ConfirmRequest {
  title: string;
  body: string;
  action: string;
  onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const dialog = (
    <Dialog
      open={request !== null}
      onClose={() => setRequest(null)}
      title={request?.title}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={() => setRequest(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            data-autofocus
            onClick={async () => {
              const r = request;
              setRequest(null);
              await r?.onConfirm();
            }}
          >
            {request?.action}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-ink-muted">{request?.body}</p>
    </Dialog>
  );
  return { confirm: setRequest, dialog };
}
