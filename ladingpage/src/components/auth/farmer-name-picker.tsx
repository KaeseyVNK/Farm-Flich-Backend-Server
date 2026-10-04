"use client";

/**
 * Màn chọn tên farmer (1 lần duy nhất cho account ví mới — spec mục 3.2):
 * ô nhập ĐIỀN SẴN tên gợi ý từ server; user xóa trắng để tự nhập tên muốn
 * dùng. NAME_TAKEN → server trả gợi ý mới: giữ nguyên tên user tự nhập,
 * chỉ thay gợi ý khi user chưa sửa.
 */
import { useState } from "react";
import { Dices, LoaderCircle, UserRound } from "lucide-react";
import { validateFarmerName } from "@/lib/farmer-name";
import { claimWalletAccount } from "./session";

type Props = {
  address: string;
  signature: string;
  suggestedName: string;
  onAuthed: () => void;
  onBackToPassword: () => void;
};

export function FarmerNamePicker({ address, signature, suggestedName, onAuthed, onBackToPassword }: Props) {
  const [name, setName] = useState(suggestedName);
  const [edited, setEdited] = useState(false); // user đã tự nhập → NAME_TAKEN không đè nội dung
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const check = validateFarmerName(name);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await claimWalletAccount(address, signature, check.value);
    setBusy(false);
    if (result.ok) {
      onAuthed();
      return;
    }
    if ("code" in result) { // nhánh WALLET_NEW_USER (duy nhất có `code`)
      if (!edited) {
        setName(result.suggestedName);
        setError(`The name "${check.value}" is already taken — we've swapped in a new suggestion, just confirm again.`);
      } else {
        setError(`The name "${check.value}" is already taken — please choose a different name.`);
      }
      return;
    }
    setError(result.error);
  };

  return (
    <div className="pixel-border flex flex-col gap-4 bg-[#fffcf0] p-6 shadow-[4px_4px_0_#231b18]" aria-live="polite">
      <div className="flex items-center gap-3">
        <UserRound className="size-8 shrink-0 text-[#c98219]" aria-hidden="true" />
        <div>
          <h3 className="font-display text-lg font-extrabold text-ink">Choose your farmer name</h3>
          <p className="mt-1 text-sm font-semibold text-ink/70">
            This name will appear on the leaderboard and your farm — you can only pick it once.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setEdited(true);
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void submit();
          }}
          maxLength={10}
          aria-label="Farmer name"
          className="min-h-11 w-full border-[3px] border-[#231b18] bg-white px-3 font-mono text-sm font-bold text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7c948]"
        />
        <button
          type="button"
          onClick={() => {
            setEdited(false);
            setName(suggestedName);
          }}
          aria-label="Use the suggested name"
          className="inline-flex min-h-11 items-center gap-1 border-[3px] border-[#231b18] bg-[#f7edcf] px-3 text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18]"
        >
          <Dices className="size-4" aria-hidden="true" />
          Suggest
        </button>
      </div>

      {error && <p className="text-sm font-bold text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="pixel-shadow-hover inline-flex min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-sun px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          Create account
        </button>
        <button
          type="button"
          onClick={onBackToPassword}
          className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-ink/70 underline hover:text-ink"
        >
          Already have an account? Log in with your password to link your wallet
        </button>
      </div>
    </div>
  );
}
