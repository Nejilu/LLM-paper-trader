"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Download, Upload, RotateCcw } from "lucide-react";

interface Portfolio {
  id: number;
  name: string;
  baseCurrency: string;
}

interface PortfolioManagerProps {
  currentPortfolio?: Portfolio | null;
  onPortfolioChange: (portfolioId: number) => void;
  onPortfolioCreate: (name: string, baseCurrency: string) => void;
  onPortfolioDelete: (portfolioId: number) => void;
  onPortfolioReset: (portfolioId: number) => void;
  onExportPortfolio: (portfolioId: number) => void;
  onImportPortfolio: (data: unknown) => void;
  portfolios: Portfolio[];
  isLoading?: boolean;
}

export function PortfolioManager({
  currentPortfolio,
  onPortfolioChange,
  onPortfolioCreate,
  onPortfolioDelete,
  onPortfolioReset,
  onExportPortfolio,
  onImportPortfolio,
  portfolios,
  isLoading = false
}: PortfolioManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState("USD");

  const hasPortfolios = portfolios.length > 0;
  const activePortfolio = currentPortfolio ?? (hasPortfolios ? portfolios[0] : null);

  const handleCreatePortfolio = () => {
    if (newPortfolioName.trim()) {
      onPortfolioCreate(newPortfolioName.trim(), newPortfolioCurrency);
      setNewPortfolioName("");
      setIsCreateDialogOpen(false);
    }
  };

  const handlePortfolioSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (!value) {
      return;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      onPortfolioChange(parsed);
    }
  };

  const handleFileImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          onImportPortfolio(data);
        } catch (error) {
          console.error("Failed to import portfolio:", error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Portfolio Selector */}
      <div className="relative">
        <select
          value={activePortfolio?.id?.toString() ?? ""}
          onChange={handlePortfolioSelect}
          disabled={isLoading || !hasPortfolios}
          className="appearance-none rounded-lg border border-border bg-card px-4 py-2 pr-8 text-sm font-medium text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:text-muted-foreground dark:border-border dark:bg-card dark:text-foreground min-w-[200px]"
        >
          {isLoading ? (
            <option value="">Loading portfolios...</option>
          ) : hasPortfolios ? (
            portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name} ({portfolio.baseCurrency})
              </option>
            ))
          ) : (
            <option value="">No portfolios yet</option>
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
          <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>

      {/* Create Portfolio */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="portfolio-name">Portfolio Name</Label>
              <Input
                id="portfolio-name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="My Portfolio"
              />
            </div>
            <div>
              <Label htmlFor="portfolio-currency">Base Currency</Label>
              <select
                id="portfolio-currency"
                value={newPortfolioCurrency}
                onChange={(e) => setNewPortfolioCurrency(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-border dark:bg-card"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePortfolio}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Portfolio */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => activePortfolio && onPortfolioReset(activePortfolio.id)}
        title="Reset current portfolio"
        disabled={!activePortfolio}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      {/* Delete Portfolio */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => activePortfolio && onPortfolioDelete(activePortfolio.id)}
        title="Delete current portfolio"
        disabled={!activePortfolio || portfolios.length <= 1}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Export Portfolio */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => activePortfolio && onExportPortfolio(activePortfolio.id)}
        title="Export portfolio data"
        disabled={!activePortfolio}
      >
        <Download className="h-4 w-4" />
      </Button>

      {/* Import Portfolio */}
      <div className="relative">
        <input
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Button variant="outline" size="sm" title="Import portfolio data">
          <Upload className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}



