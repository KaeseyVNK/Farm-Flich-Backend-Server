import { JsonLd } from "@/components/landing/json-ld";
import { HomeLanding } from "./home-landing";

export default function Home() {
  return (
    <>
      <JsonLd />
      <HomeLanding />
    </>
  );
}
