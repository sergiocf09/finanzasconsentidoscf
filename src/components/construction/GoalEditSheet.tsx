import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useSavingsGoals, SavingsGoal } from "@/hooks/useSavingsGoals";

const editSchema = z.object({
  name: z.string().min(1),
  target_amount: z.coerce.number().min(1),
  description: z.string().optional(),
});

type EditValues = z.infer<typeof editSchema>;

interface GoalEditSheetProps {
  goal: SavingsGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalEditSheet({ goal, open, onOpenChange }: GoalEditSheetProps) {
  const { updateGoal } = useSavingsGoals();

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", target_amount: 0, description: "" },
  });

  useEffect(() => {
    if (goal) {
      form.reset({
        name: goal.name,
        target_amount: goal.target_amount,
        description: goal.description || "",
      });
    }
  }, [goal, form]);

  const onSubmit = async (data: EditValues) => {
    if (!goal) return;
    await updateGoal.mutateAsync({ id: goal.id, ...data });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar meta</SheetTitle>
          <SheetDescription>Modifica los datos de tu meta.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto objetivo</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Textarea className="resize-none h-16" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={updateGoal.isPending}>
              {updateGoal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
