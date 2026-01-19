"use client";

import { useForm } from "@tanstack/react-form";
import { Briefcase, Building, Globe, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createApplicationSchema } from "@/lib/validations/application";
import { applicationsService } from "@/services/applications.service";

interface NewApplicationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-destructive">{error}</p>;
}

export function NewApplicationForm({
  onSuccess,
  onCancel,
}: NewApplicationFormProps) {
  const form = useForm({
    defaultValues: {
      companyName: "",
      domain: "",
      position: "",
      website: "",
      notes: "",
    },
    validators: { onChange: createApplicationSchema },
    onSubmit: async ({ value }) => {
      try {
        await applicationsService.createApplication(value);
        onSuccess();
      } catch (err) {
        console.error("Failed to create application:", err);
      }
    },
  });

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">
          Add New Application
        </h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="companyName">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Company Name
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. Google"
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all",
                    field.state.meta.errors.length > 0
                      ? "border-destructive"
                      : "border-border",
                  )}
                />
              </div>
              <FieldError error={field.state.meta.errors[0]?.message} />
            </div>
          )}
        </form.Field>

        <form.Field name="domain">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Company Domain
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. google.com"
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all",
                    field.state.meta.errors.length > 0
                      ? "border-destructive"
                      : "border-border",
                  )}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Used to automatically match Resend emails.
              </p>
              <FieldError error={field.state.meta.errors[0]?.message} />
            </div>
          )}
        </form.Field>

        <form.Field name="position">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Job Position
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. Frontend Developer"
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all",
                    field.state.meta.errors.length > 0
                      ? "border-destructive"
                      : "border-border",
                  )}
                />
              </div>
              <FieldError error={field.state.meta.errors[0]?.message} />
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Application
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 px-4 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors border border-border"
              >
                Cancel
              </button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
