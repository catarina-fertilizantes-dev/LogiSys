import { z } from "zod";

export const emailSchema = z.string().trim().email("Email inválido").max(255, "Email muito longo");
export const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");
export const nomeSchema = z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo");
