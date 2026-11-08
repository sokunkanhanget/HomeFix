import { useState } from "react";
import { categories } from "../data/homepage.js";
import Icon from "./Icon.jsx";
import SectionHeading from "./SectionHeading.jsx";

export default function CategorySection({ onSelectCategory }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <section className="bg-white py-[74px] max-sm:py-[52px]" id="categories">
      <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px]">
        <SectionHeading
          eyebrow="CATEGORIES"
          title="Popular repair categories"
          description="Pick what needs fixing and we’ll show shops that handle it."
          action={
            <button
              className="inline-flex shrink-0 items-center gap-1.5 py-2 text-sm font-semibold text-[#315b82] hover:text-navy"
              onClick={() => setShowAll((current) => !current)}
              aria-expanded={showAll}
            >
              <Icon name="arrow" size={15} /> {showAll ? "Show popular" : "View all categories"}
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-[17px]">
          {categories.slice(0, showAll ? categories.length : 8).map((category) => (
            <button
              className="grid min-h-[125px] content-start justify-items-start rounded-[13px] border border-[#e4e9ef] bg-white p-[14px] text-left transition hover:-translate-y-0.5 hover:border-[#b7c9dc] hover:shadow-lg md:min-h-[133px] md:p-[17px_18px]"
              key={category.name}
              onClick={() => onSelectCategory(category.name)}
            >
              <span className="mb-3 grid size-[42px] place-items-center rounded-[10px] bg-[#e6eef7] text-[#345b7e]">
                <Icon name={category.icon} size={22} />
              </span>
              <strong className="text-[15px] font-semibold text-[#233b57]">{category.name}</strong>
              <small className="mt-1 text-[13px] text-[#8491a0]">{category.count} repair shops</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
