import { redirect } from "next/navigation";
import { DEFAULT_CITY_SLUG } from "@/data/cities";

export default function Home() {
  redirect(`/${DEFAULT_CITY_SLUG}`);
}
