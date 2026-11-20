import { SEVERITY_HEX } from "../../domain/severity";

/**
 * A drawing of what Debrief produces: a finding page laid over a report
 * cover. Built from boxes so it follows the theme and costs no image.
 */
export function ReportSketch() {
  return (
    <div aria-hidden className="relative hidden h-[330px] w-[400px] shrink-0 select-none lg:block">
      {/* Cover */}
      <div className="absolute left-0 top-4 h-[300px] w-[214px] -rotate-[5deg] overflow-hidden rounded-[6px] bg-white shadow-[0_24px_60px_-18px_rgb(0_0_0/0.55)] ring-1 ring-black/5">
        <div className="absolute inset-y-0 left-0 w-[7px] bg-[#036877]" />
        <div className="absolute right-4 top-4 rounded-[3px] border border-[#036877] px-1.5 py-[1px] text-[5.5px] font-bold tracking-[0.12em] text-[#036877]">
          CONFIDENTIAL
        </div>
        <div className="absolute left-6 top-[118px] right-5">
          <div className="text-[5.5px] font-bold tracking-[0.2em] text-[#036877]">
            PENETRATION TEST REPORT
          </div>
          <div className="mt-1.5 text-[17px] font-semibold leading-[1.05] tracking-[-0.02em] text-[#0b1215]">
            External web application test
          </div>
          <div className="mt-1 text-[7.5px] text-[#5b6b70]">Northwind Traders</div>
          <div className="mt-2.5 h-[2px] w-6 bg-[#036877]" />
        </div>
        <div className="absolute inset-x-6 bottom-6 grid grid-cols-2 gap-y-2 border-t border-[#e3e9ea] pt-2">
          {["PREPARED FOR", "REPORT DATE"].map((k) => (
            <div key={k}>
              <div className="text-[4.5px] font-bold tracking-[0.14em] text-[#8a989c]">{k}</div>
              <div className="mt-[2px] h-[4px] w-14 rounded-full bg-[#d5dee0]" />
            </div>
          ))}
        </div>
      </div>

      {/* Finding page */}
      <div className="absolute right-0 top-0 h-[310px] w-[222px] rotate-[3deg] overflow-hidden rounded-[6px] bg-white p-5 shadow-[0_30px_70px_-20px_rgb(0_0_0/0.6)] ring-1 ring-black/5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[6.5px] font-bold text-[#036877]">F-01</span>
          <span
            className="rounded-[2px] px-1 py-[1px] text-[5px] font-bold tracking-[0.1em] text-white"
            style={{ background: SEVERITY_HEX.High }}
          >
            HIGH
          </span>
        </div>
        <div className="mt-1.5 text-[10.5px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1215]">
          Insecure direct object reference
        </div>
        <div className="mt-2.5 flex overflow-hidden rounded-[3px] border border-[#e3e9ea]">
          <div className="w-12 px-2 py-1.5" style={{ background: "#fbeee6" }}>
            <div className="text-[4.5px] font-bold tracking-[0.12em] text-[#8a989c]">CVSS 3.1</div>
            <div
              className="text-[13px] font-semibold leading-none"
              style={{ color: SEVERITY_HEX.High }}
            >
              7.1
            </div>
          </div>
          <div className="flex-1 px-2 py-1.5">
            <div className="text-[4.5px] font-bold tracking-[0.12em] text-[#8a989c]">VECTOR</div>
            <div className="mt-[3px] h-[3px] w-full rounded-full bg-[#d5dee0]" />
            <div className="mt-[3px] h-[3px] w-2/3 rounded-full bg-[#d5dee0]" />
          </div>
        </div>
        {["DESCRIPTION", "STEPS TO REPRODUCE"].map((title, i) => (
          <div key={title} className="mt-3">
            <div className="text-[5px] font-bold tracking-[0.16em] text-[#036877]">{title}</div>
            {i === 0 ? (
              <>
                <div className="mt-1.5 h-[3px] w-full rounded-full bg-[#e1e7e9]" />
                <div className="mt-[3px] h-[3px] w-[92%] rounded-full bg-[#e1e7e9]" />
                <div className="mt-[3px] h-[3px] w-[70%] rounded-full bg-[#e1e7e9]" />
              </>
            ) : (
              <div className="mt-1.5 rounded-[3px] border border-[#e3e9ea] bg-[#f5f8f8] px-2 py-1.5 font-mono text-[5.5px] leading-[1.6]">
                <div>
                  <span className="text-[#b3541e]">GET</span>{" "}
                  <span className="text-[#036877]">/api/invoices/1002</span>
                </div>
                <div className="text-[#5b6b70]">Authorization: Bearer eyJhbGci...</div>
                <div className="text-[#5b6b70]">
                  {'{"owner":'} <span className="text-[#2f6b3a]">"bob"</span>
                  {"}"}
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="mt-3 text-[5px] font-bold tracking-[0.16em] text-[#036877]">
          REMEDIATION
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <span className="size-[3px] rounded-full bg-[#036877]" />
          <span className="h-[3px] w-[80%] rounded-full bg-[#e1e7e9]" />
        </div>
      </div>
    </div>
  );
}
