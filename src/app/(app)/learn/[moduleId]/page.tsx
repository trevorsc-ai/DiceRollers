import { notFound } from "next/navigation";
import Lesson from "../components/Lesson";
import { MODULES, getAdjacent, getModule } from "../content";

export function generateStaticParams() {
  return MODULES.map((m) => ({ moduleId: m.id }));
}

export default async function ModulePage({
  params,
}: {
  params: { moduleId: string };
}) {
  const mod = getModule(params.moduleId);
  if (!mod) notFound();

  const { default: Mdx } = await mod.load();
  const { prev, next } = getAdjacent(mod.id);

  return (
    <Lesson
      moduleId={mod.id}
      title={mod.title}
      number={mod.number}
      estMinutes={mod.estMinutes}
      prev={prev && { id: prev.id, title: prev.title }}
      next={next && { id: next.id, title: next.title }}
    >
      <Mdx />
    </Lesson>
  );
}
