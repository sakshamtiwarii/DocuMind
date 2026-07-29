import { Loader2 } from "lucide-react";
import clsx from "clsx";

export default function Spinner({ className }) {
  return <Loader2 className={clsx("animate-spin", className)} />;
}
