import { notFound } from "next/navigation";

// There is no public index: `/` is a 404 like any unknown address.
export default function Home() {
  notFound();
}
