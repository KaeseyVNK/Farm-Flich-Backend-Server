"use client";

import { FAQS } from "@/lib/faqs";
import { CropIcon } from "./pixel-sprite";
import { Reveal, SectionHeader } from "./reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-cream py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <SectionHeader
          badge="FAQ"
          badgeIcon={<CropIcon name="mushroom" size={16} />}
          title="Hỏi trước khi gieo hạt"
          desc="Năm câu thật — không thổi số người chơi."
        />
        <Reveal>
          <Accordion type="single" collapsible defaultValue="item-0" className="pixel-border rounded-md bg-white px-4">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`}>
                <AccordionTrigger className="font-display text-left text-base font-extrabold md:text-lg">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm font-semibold leading-relaxed text-foreground/75 md:text-base">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
        <p className="mt-8 text-center text-sm font-semibold text-muted-foreground">
          Còn thắc mắc?{" "}
          <a href="#bat-dau" className="font-extrabold text-grass-dark underline-offset-2 hover:underline">
            Để email
          </a>{" "}
          — chúng tôi trả lời khi mở kênh cộng đồng.
        </p>
      </div>
    </section>
  );
}
