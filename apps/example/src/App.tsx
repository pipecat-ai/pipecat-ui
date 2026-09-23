import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Mic,
  MoreHorizontal,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  Volume2,
} from "lucide-react";

type Message = { role: "bot" | "caller"; text: string; time: string };

const cases = [
  { id: "identity", label: "Xác thực danh tính", status: "Sẵn sàng" },
  { id: "confirm", label: "Xác nhận lịch khám", status: "Sẵn sàng" },
  { id: "silence", label: "3 lượt im lặng", status: "Sẵn sàng" },
];

const initialMessages: Message[] = [
  {
    role: "bot",
    text: "Chào anh/chị. Để bảo vệ thông tin lịch khám, anh/chị vui lòng cho em xin họ tên và ngày sinh ạ.",
    time: "09:41",
  },
];

export default function App() {
  const [selectedCase, setSelectedCase] = useState("identity");
  const [isListening, setIsListening] = useState(false);
  const [isStarted, setIsStarted] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const activeCase = useMemo(
    () => cases.find((item) => item.id === selectedCase) ?? cases[0],
    [selectedCase],
  );

  function startNewCall() {
    setIsStarted(true);
    setIsListening(false);
    setMessages(initialMessages);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { role: "caller", text, time: "09:42" },
      {
        role: "bot",
        text: "Em đã ghi nhận. Anh/chị cho em một chút thời gian để kiểm tra thông tin nhé.",
        time: "09:42",
      },
    ]);
    setDraft("");
  }

  return (
    <main className="min-h-svh bg-[#f7f8f8] text-[#17201d]">
      <header className="border-b border-[#e6ebe8] bg-white px-5 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#0b6957] text-white shadow-sm">
              <Activity size={21} strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Vinmec Callbot
              </p>
              <p className="text-xs text-[#71817b]">Voice assistant console</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#e1e8e4] bg-[#fafcfb] px-3 py-1.5 text-xs font-medium text-[#547068] sm:flex">
            <span className="size-2 rounded-full bg-[#2aa678]" /> Hệ thống hoạt
            động
          </div>
          <button
            className="grid size-9 place-items-center rounded-full border border-[#e1e8e4] text-[#5b6d66]"
            aria-label="Mở menu"
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-5 p-5 lg:grid-cols-[270px_minmax(0,1fr)_330px] lg:p-8">
        <aside className="rounded-2xl border border-[#e3e9e5] bg-white p-4 shadow-[0_1px_2px_rgba(21,40,33,.03)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[.12em] text-[#7b8984] uppercase">
                Demo Sprint 1
              </p>
              <h2 className="mt-1 text-base font-semibold">
                Kịch bản kiểm thử
              </h2>
            </div>
            <ShieldCheck size={20} className="text-[#0b8068]" />
          </div>
          <div className="space-y-2">
            {cases.map((item, index) => {
              const active = item.id === selectedCase;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedCase(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-[#94cfbc] bg-[#effaf5]" : "border-transparent bg-[#fbfcfb] hover:border-[#e2eae6]"}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? "bg-[#0b8068] text-white" : "bg-[#edf1ef] text-[#617069]"}`}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs text-[#71817b]">
                        {item.status}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 border-t border-[#edf0ee] pt-5">
            <p className="text-xs leading-5 text-[#71817b]">
              Dữ liệu demo là synthetic. Không nhập thông tin bệnh nhân thật.
            </p>
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(21,40,33,.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ecf0ed] px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#71817b]">
                <span className="size-2 rounded-full bg-[#2aa678]" />
                Cuộc gọi outbound · call_demo_00417
              </div>
              <h1 className="mt-1 text-lg font-semibold">{activeCase.label}</h1>
            </div>
            <button
              onClick={startNewCall}
              className="rounded-lg bg-[#0b6957] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#095847]"
            >
              Ca mới
            </button>
          </div>
          <div className="relative flex min-h-[510px] flex-col px-5 py-6">
            <div className="voice-orb mx-auto mb-6 grid size-28 place-items-center rounded-full">
              <div className="grid size-[78px] place-items-center rounded-full bg-white/85 text-[#0b8068] shadow-sm">
                <Volume2 size={27} />
              </div>
            </div>
            <p className="mb-6 text-center text-sm text-[#677872]">
              {isListening ? "Đang nghe người gọi…" : "Bot đang chờ phản hồi"}
            </p>
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
              {messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`flex gap-2.5 ${message.role === "caller" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full ${message.role === "bot" ? "bg-[#e1f4ec] text-[#0b8068]" : "bg-[#edf1ef] text-[#617069]"}`}
                  >
                    {message.role === "bot" ? (
                      <Stethoscope size={14} />
                    ) : (
                      <UserRoundCheck size={14} />
                    )}
                  </div>
                  <div
                    className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "bot" ? "rounded-tl-sm bg-[#f2f7f5] text-[#26342f]" : "rounded-tr-sm bg-[#0b6957] text-white"}`}
                  >
                    {message.text}
                    <p
                      className={`mt-1 text-[11px] ${message.role === "bot" ? "text-[#84918c]" : "text-white/65"}`}
                    >
                      {message.time}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <div className="mx-auto mt-6 flex w-full max-w-2xl items-end gap-3 rounded-2xl border border-[#dfe7e2] bg-[#fbfcfb] p-2 focus-within:border-[#87bca9] focus-within:ring-4 focus-within:ring-[#e4f4ed]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Nhập phản hồi của người gọi..."
                className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#9aa6a1]"
                rows={1}
              />
              <button
                onClick={() => setIsListening((value) => !value)}
                className={`grid size-10 place-items-center rounded-xl transition ${isListening ? "bg-[#dff5eb] text-[#08775f]" : "bg-[#edf2ef] text-[#5f716a]"}`}
                aria-label="Bật hoặc tắt micro"
              >
                <Mic size={18} />
              </button>
              <button
                onClick={sendMessage}
                className="grid size-10 place-items-center rounded-xl bg-[#0b6957] text-white"
                aria-label="Gửi tin nhắn"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[#e3e9e5] bg-white p-5 shadow-[0_1px_2px_rgba(21,40,33,.03)]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Trạng thái phiên</h2>
              <span className="rounded-full bg-[#e8f8ef] px-2.5 py-1 text-xs font-medium text-[#08775f]">
                Đang chạy
              </span>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[#71817b]">Luồng</dt>
                <dd className="font-medium">Outbound</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#71817b]">Trạng thái</dt>
                <dd className="font-medium">AWAITING_IDENTITY</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#71817b]">Số lượt</dt>
                <dd className="font-medium">{messages.length}/20</dd>
              </div>
            </dl>
            <button
              onClick={() => setIsStarted(false)}
              disabled={!isStarted}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#f0d7d0] bg-[#fff8f6] px-3 py-2.5 text-sm font-medium text-[#b84736] disabled:opacity-50"
            >
              <PhoneOff size={16} /> Kết thúc phiên
            </button>
          </section>
          <section className="rounded-2xl border border-[#e3e9e5] bg-white p-5 shadow-[0_1px_2px_rgba(21,40,33,.03)]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Lịch trên Clinic Mock</h2>
              <ChevronDown size={17} className="text-[#809089]" />
            </div>
            <div className="mt-4 rounded-xl bg-[#f5f8f6] p-4">
              <p className="text-xs text-[#7b8984]">Mã lịch</p>
              <p className="mt-1 font-mono text-sm font-semibold">apt_00417</p>
              <div className="mt-4 flex gap-3 text-sm text-[#5b6d66]">
                <CalendarDays size={17} className="text-[#0b8068]" />
                26/09/2026 · Nội tổng quát
              </div>
              <div className="mt-3 flex gap-3 text-sm text-[#5b6d66]">
                <Clock3 size={17} className="text-[#0b8068]" />
                09:30 – 10:00
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#fff9ed] p-3 text-xs leading-5 text-[#896629]">
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              Không hiển thị thông tin lịch trước khi xác thực danh tính.
            </div>
          </section>
          <section className="rounded-2xl bg-[#0b6957] p-5 text-white shadow-sm">
            <p className="text-xs font-medium tracking-[.12em] text-white/65 uppercase">
              Sprint 1 gate
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Check size={18} className="rounded-full bg-white/20 p-0.5" />
              <span className="text-sm font-medium">
                Text flow sẵn sàng demo
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/75">
              Audio và official scoring sẽ được nối ở các bước tiếp theo.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
