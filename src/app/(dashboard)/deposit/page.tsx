"use client";

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
import { Separator } from "@/components/ui/separator";
import { Wallet, CreditCard, Coins } from "lucide-react";
import { useState } from "react";

const paymentMethods = [
  {
    id: "naira",
    name: "Naira (₦)",
    description: "Pay with bank transfer or card",
    icon: CreditCard,
  },
  {
    id: "usd",
    name: "USD ($)",
    description: "Pay with international card",
    icon: CreditCard,
  },
  {
    id: "0g",
    name: "0G Tokens",
    description: "Pay with 0G tokens from your wallet",
    icon: Coins,
  },
];

export default function DepositPage() {
  const [selectedMethod, setSelectedMethod] = useState("naira");
  const [amount, setAmount] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deposit Funds</h1>
        <p className="text-muted-foreground">
          Add funds to your AskZero account
        </p>
      </div>

      <Separator />

      {/* Current Balance */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="rounded-full bg-primary/10 p-3">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">&#8358;0.00</p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Choose how you want to fund your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                selectedMethod === method.id
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:bg-accent"
              }`}
            >
              <method.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{method.name}</p>
                <p className="text-sm text-muted-foreground">
                  {method.description}
                </p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Amount */}
      <Card>
        <CardHeader>
          <CardTitle>Amount</CardTitle>
          <CardDescription>
            Enter the amount you want to deposit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount (
              {selectedMethod === "naira"
                ? "₦"
                : selectedMethod === "usd"
                  ? "$"
                  : "0G"}
              )
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(selectedMethod === "naira"
              ? ["500", "1000", "2000", "5000"]
              : selectedMethod === "usd"
                ? ["5", "10", "25", "50"]
                : ["10", "50", "100", "500"]
            ).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => setAmount(preset)}
              >
                {selectedMethod === "naira"
                  ? `₦${preset}`
                  : selectedMethod === "usd"
                    ? `$${preset}`
                    : `${preset} 0G`}
              </Button>
            ))}
          </div>
          <Button className="w-full" disabled={!amount}>
            Deposit {amount && (selectedMethod === "naira"
              ? `₦${amount}`
              : selectedMethod === "usd"
                ? `$${amount}`
                : `${amount} 0G`)}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Payment processing will be enabled in a future update
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
