import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormPlaceholderProps = {
  title: string;
  description: string;
  footer: React.ReactNode;
};

export function AuthFormPlaceholder({
  title,
  description,
  footer,
}: AuthFormPlaceholderProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@restaurant.com"
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" disabled />
        </div>
        <Button className="w-full" disabled>
          Coming soon
        </Button>
        <p className="text-muted-foreground text-center text-sm">{footer}</p>
      </CardContent>
    </Card>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-foreground font-medium underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
