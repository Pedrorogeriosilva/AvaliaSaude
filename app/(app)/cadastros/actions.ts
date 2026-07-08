"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  isUserManagementGateUnlocked,
  unlockUserManagementGate,
  validateAdminCreationPasswordValue,
} from "@/lib/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim() || null;
}

function digitsOnly(value: string | null) {
  return value?.replace(/\D/g, "") || null;
}

function target(path: string, message: string) {
  return `${path}?error=${encodeURIComponent(message)}`;
}

function successTarget(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

function revalidateOperationalData(...paths: string[]) {
  revalidateTag("reference-data");
  revalidateTag("dashboard-data");
  revalidateTag("ranking-data");
  paths.forEach((path) => revalidatePath(path));
}

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

export async function createPatientAction(formData: FormData) {
  const path = "/cadastros/pacientes";
  let errorMessage: string | null = null;

  try {
    const fullName = clean(formData.get("full_name"));

    if (!fullName || fullName.length < 3) {
      errorMessage = "Informe o nome completo do paciente.";
    } else {
      const supabase = await createClient();
      const userId = await getUserId(supabase);
      const { error } = await supabase.from("patients").insert({
        full_name: fullName,
        cpf: digitsOnly(clean(formData.get("cpf"))),
        birth_date: clean(formData.get("birth_date")),
        phone: clean(formData.get("phone")),
        whatsapp: clean(formData.get("whatsapp")),
        address: clean(formData.get("address")),
        neighborhood: clean(formData.get("neighborhood")),
        status: "active",
        created_by: userId,
      });

      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage =
      "Não foi possível cadastrar o paciente. Confira a conexão e as permissões.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie");
}

export async function togglePatientStatusAction(formData: FormData) {
  const path = "/cadastros/pacientes";
  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();
    const id = String(formData.get("id") || "");
    const status =
      String(formData.get("status")) === "active" ? "inactive" : "active";

    if (!id) {
      errorMessage = "Paciente não identificado.";
    } else {
      const { error } = await supabase
        .from("patients")
        .update({ status })
        .eq("id", id);
      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage = "Não foi possível atualizar o paciente.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie");
}

export async function updatePatientAction(formData: FormData) {
  const path = "/cadastros/pacientes";
  let errorMessage: string | null = null;

  try {
    const id = String(formData.get("id") || "");
    const fullName = clean(formData.get("full_name"));
    const status = String(formData.get("status") || "active");

    if (!id) {
      errorMessage = "Paciente não identificado.";
    } else if (!fullName || fullName.length < 3) {
      errorMessage = "Informe o nome completo do paciente.";
    } else if (!isValidStatus(status)) {
      errorMessage = "Status do paciente inválido.";
    } else {
      const supabase = await createClient();
      const { error } = await supabase
        .from("patients")
        .update({
          full_name: fullName,
          cpf: digitsOnly(clean(formData.get("cpf"))),
          birth_date: clean(formData.get("birth_date")),
          phone: clean(formData.get("phone")),
          whatsapp: clean(formData.get("whatsapp")),
          address: clean(formData.get("address")),
          neighborhood: clean(formData.get("neighborhood")),
          status,
        })
        .eq("id", id);

      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage =
      "Não foi possível editar o paciente. Confira a conexão e as permissões.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
  redirect(successTarget(path, "Paciente atualizado com sucesso."));
}

export async function deletePatientAction(formData: FormData) {
  const path = "/cadastros/pacientes";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    const id = String(formData.get("id") || "");
    const confirmDelete = String(formData.get("confirm_delete") || "") === "1";

    if (!currentAdmin) {
      errorMessage =
        "Apenas administradores podem excluir pacientes definitivamente.";
    } else if (!id) {
      errorMessage = "Paciente não identificado.";
    } else if (!confirmDelete) {
      errorMessage =
        "Confirme a exclusão definitiva do paciente antes de continuar.";
    }

    if (!errorMessage) {
      const admin = createAdminClient();
      const { data: evaluations, error: evaluationsError } = await admin
        .from("evaluations")
        .select("id")
        .eq("patient_id", id);

      if (evaluationsError) {
        errorMessage = evaluationsError.message;
      } else {
        const evaluationIds = (evaluations || []).map(
          (evaluation) => evaluation.id as string,
        );

        if (evaluationIds.length) {
          const { error: linkedError } = await admin
            .from("evaluation_professionals")
            .delete()
            .in("evaluation_id", evaluationIds);
          if (linkedError) errorMessage = linkedError.message;

          if (!errorMessage) {
            const { error: evaluationDeleteError } = await admin
              .from("evaluations")
              .delete()
              .in("id", evaluationIds);
            if (evaluationDeleteError)
              errorMessage = evaluationDeleteError.message;
          }
        }

        if (!errorMessage) {
          const { error } = await admin.from("patients").delete().eq("id", id);
          if (error) errorMessage = error.message;
        }
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o paciente. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
  redirect(
    successTarget(path, "Paciente e avaliações vinculadas foram excluídos."),
  );
}

export async function createHealthUnitAction(formData: FormData) {
  const path = "/cadastros/unidades";
  let errorMessage: string | null = null;

  try {
    const name = clean(formData.get("name"));
    const address = clean(formData.get("address"));

    if (!name || name.length < 3) {
      errorMessage = "Informe o nome da unidade.";
    } else if (!address || address.length < 5) {
      errorMessage = "Informe o endereço da unidade.";
    } else {
      const supabase = await createClient();
      const userId = await getUserId(supabase);
      const { error } = await supabase.from("health_units").insert({
        name,
        type: String(formData.get("type") || "psf"),
        address,
        neighborhood: clean(formData.get("neighborhood")),
        phone: clean(formData.get("phone")),
        manager_name: clean(formData.get("manager_name")),
        status: "active",
        created_by: userId,
      });

      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage =
      "Não foi possível cadastrar a unidade. Confira a conexão e as permissões.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
}

export async function toggleHealthUnitStatusAction(formData: FormData) {
  const path = "/cadastros/unidades";
  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();
    const id = String(formData.get("id") || "");
    const status =
      String(formData.get("status")) === "active" ? "inactive" : "active";

    if (!id) {
      errorMessage = "Unidade não identificada.";
    } else {
      const { error } = await supabase
        .from("health_units")
        .update({ status })
        .eq("id", id);
      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage = "Não foi possível atualizar a unidade.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
}

export async function updateHealthUnitAction(formData: FormData) {
  const path = "/cadastros/unidades";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    const id = String(formData.get("id") || "");
    const name = clean(formData.get("name"));
    const address = clean(formData.get("address"));
    const type = String(formData.get("type") || "psf");
    const status = String(formData.get("status") || "active");

    if (!currentAdmin) {
      errorMessage = "Apenas administradores podem editar unidades de saúde.";
    } else if (!id) {
      errorMessage = "Unidade não identificada.";
    } else if (!name || name.length < 3) {
      errorMessage = "Informe o nome da unidade.";
    } else if (!address || address.length < 5) {
      errorMessage = "Informe o endereço da unidade.";
    } else if (!["psf", "hospital", "other"].includes(type)) {
      errorMessage = "Tipo de unidade inválido.";
    } else if (!isValidStatus(status)) {
      errorMessage = "Status da unidade inválido.";
    }

    if (!errorMessage) {
      const admin = createAdminClient();
      const { error } = await admin
        .from("health_units")
        .update({
          name,
          type,
          address,
          neighborhood: clean(formData.get("neighborhood")),
          phone: clean(formData.get("phone")),
          manager_name: clean(formData.get("manager_name")),
          status,
        })
        .eq("id", id);

      if (error) errorMessage = error.message;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível editar a unidade. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
  redirect(successTarget(path, "Unidade atualizada com sucesso."));
}

export async function deleteHealthUnitAction(formData: FormData) {
  const path = "/cadastros/unidades";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    const id = String(formData.get("id") || "");
    const confirmDelete = String(formData.get("confirm_delete") || "") === "1";

    if (!currentAdmin) {
      errorMessage =
        "Apenas administradores podem excluir unidades definitivamente.";
    } else if (!id) {
      errorMessage = "Unidade não identificada.";
    } else if (!confirmDelete) {
      errorMessage =
        "Confirme a exclusão definitiva da unidade antes de continuar.";
    }

    if (!errorMessage) {
      const admin = createAdminClient();
      const [
        { data: evaluations, error: evaluationsError },
        { data: professionals, error: professionalsError },
      ] = await Promise.all([
        admin.from("evaluations").select("id").eq("health_unit_id", id),
        admin.from("professionals").select("id").eq("health_unit_id", id),
      ]);

      const firstError = evaluationsError || professionalsError;
      if (firstError) {
        errorMessage = firstError.message;
      } else {
        const evaluationIds = (evaluations || []).map(
          (evaluation) => evaluation.id as string,
        );
        const professionalIds = (professionals || []).map(
          (professional) => professional.id as string,
        );

        if (evaluationIds.length) {
          const { error } = await admin
            .from("evaluation_professionals")
            .delete()
            .in("evaluation_id", evaluationIds);
          if (error) errorMessage = error.message;
        }

        if (!errorMessage && professionalIds.length) {
          const { error } = await admin
            .from("evaluation_professionals")
            .delete()
            .in("professional_id", professionalIds);
          if (error) errorMessage = error.message;
        }

        if (!errorMessage && evaluationIds.length) {
          const { error } = await admin
            .from("evaluations")
            .delete()
            .in("id", evaluationIds);
          if (error) errorMessage = error.message;
        }

        if (!errorMessage && professionalIds.length) {
          const { error } = await admin
            .from("professionals")
            .delete()
            .in("id", professionalIds);
          if (error) errorMessage = error.message;
        }

        if (!errorMessage) {
          const { error } = await admin
            .from("health_units")
            .delete()
            .eq("id", id);
          if (error) errorMessage = error.message;
        }
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir a unidade. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
  redirect(
    successTarget(
      path,
      "Unidade, profissionais e avaliações vinculadas foram excluídos.",
    ),
  );
}

export async function createProfessionalAction(formData: FormData) {
  const path = "/cadastros/profissionais";
  let errorMessage: string | null = null;

  try {
    const fullName = clean(formData.get("full_name"));
    const position = clean(formData.get("position"));
    const healthUnitId = String(formData.get("health_unit_id") || "");

    if (!fullName || fullName.length < 3) {
      errorMessage = "Informe o nome completo do profissional.";
    } else if (!position || position.length < 2) {
      errorMessage = "Informe o cargo ou função do profissional.";
    } else if (!healthUnitId) {
      errorMessage = "Selecione a unidade vinculada.";
    } else {
      const supabase = await createClient();
      const userId = await getUserId(supabase);
      const { error } = await supabase.from("professionals").insert({
        full_name: fullName,
        position,
        professional_license: clean(formData.get("professional_license")),
        health_unit_id: healthUnitId,
        work_schedule: clean(formData.get("work_schedule")),
        status: "active",
        created_by: userId,
      });

      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage =
      "Não foi possível cadastrar o profissional. Confira a conexão e as permissões.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
}

export async function toggleProfessionalStatusAction(formData: FormData) {
  const path = "/cadastros/profissionais";
  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();
    const id = String(formData.get("id") || "");
    const status =
      String(formData.get("status")) === "active" ? "inactive" : "active";

    if (!id) {
      errorMessage = "Profissional não identificado.";
    } else {
      const { error } = await supabase
        .from("professionals")
        .update({ status })
        .eq("id", id);
      if (error) errorMessage = error.message;
    }
  } catch {
    errorMessage = "Não foi possível atualizar o profissional.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
}

export async function updateProfessionalAction(formData: FormData) {
  const path = "/cadastros/profissionais";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    const id = String(formData.get("id") || "");
    const fullName = clean(formData.get("full_name"));
    const position = clean(formData.get("position"));
    const healthUnitId = String(formData.get("health_unit_id") || "");
    const status = String(formData.get("status") || "active");

    if (!currentAdmin) {
      errorMessage = "Apenas administradores podem editar profissionais.";
    } else if (!id) {
      errorMessage = "Profissional não identificado.";
    } else if (!fullName || fullName.length < 3) {
      errorMessage = "Informe o nome completo do profissional.";
    } else if (!position || position.length < 2) {
      errorMessage = "Informe o cargo ou função do profissional.";
    } else if (!healthUnitId) {
      errorMessage = "Selecione a unidade vinculada.";
    } else if (!isValidStatus(status)) {
      errorMessage = "Status do profissional inválido.";
    }

    if (!errorMessage) {
      const admin = createAdminClient();
      const { error } = await admin
        .from("professionals")
        .update({
          full_name: fullName,
          position,
          professional_license: clean(formData.get("professional_license")),
          health_unit_id: healthUnitId,
          work_schedule: clean(formData.get("work_schedule")),
          status,
        })
        .eq("id", id);

      if (error) errorMessage = error.message;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível editar o profissional. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
  redirect(successTarget(path, "Profissional atualizado com sucesso."));
}

export async function deleteProfessionalAction(formData: FormData) {
  const path = "/cadastros/profissionais";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    const id = String(formData.get("id") || "");
    const confirmDelete = String(formData.get("confirm_delete") || "") === "1";

    if (!currentAdmin) {
      errorMessage =
        "Apenas administradores podem excluir profissionais definitivamente.";
    } else if (!id) {
      errorMessage = "Profissional não identificado.";
    } else if (!confirmDelete) {
      errorMessage =
        "Confirme a exclusão definitiva do profissional antes de continuar.";
    }

    if (!errorMessage) {
      const admin = createAdminClient();
      const { error: linkedError } = await admin
        .from("evaluation_professionals")
        .delete()
        .eq("professional_id", id);
      if (linkedError) {
        errorMessage = linkedError.message;
      } else {
        const { error } = await admin
          .from("professionals")
          .delete()
          .eq("id", id);
        if (error) errorMessage = error.message;
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o profissional. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidateOperationalData(path, "/avalie", "/painel", "/ranking");
  redirect(successTarget(path, "Profissional excluído com sucesso."));
}

function isValidRole(value: string) {
  return ["admin", "operator", "viewer"].includes(value);
}

function isValidStatus(value: string) {
  return ["active", "inactive"].includes(value);
}

function cleanPassword(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function validateUserManagementGate(profile: { id: string } | null) {
  if (!profile) return "Apenas administradores podem gerenciar usuários do sistema.";

  const isUnlocked = await isUserManagementGateUnlocked(profile.id);
  if (!isUnlocked) {
    return "Informe a senha adicional antes de acessar a gestão de usuários.";
  }

  return null;
}

async function getCurrentAdminProfile() {
  const profile = await getCurrentProfile();
  return profile?.role === "admin" ? profile : null;
}

export async function unlockUserManagementAction(formData: FormData) {
  const path = "/cadastros/usuarios";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    if (!currentAdmin) {
      errorMessage =
        "Apenas administradores podem acessar a gestão de usuários.";
    } else {
      errorMessage = validateAdminCreationPasswordValue(
        formData.get("admin_creation_password"),
        "visualizar a gestão de usuários",
      );
      if (!errorMessage) await unlockUserManagementGate(currentAdmin.id);
    }
  } catch {
    errorMessage = "Não foi possível liberar a gestão de usuários.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  redirect(successTarget(path, "Gestão de usuários liberada temporariamente."));
}

export async function createSystemUserAction(formData: FormData) {
  const path = "/cadastros/usuarios";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    if (!currentAdmin) {
      errorMessage = "Apenas administradores podem criar usuários do sistema.";
    } else {
      errorMessage = await validateUserManagementGate(currentAdmin);
    }

    if (!errorMessage && currentAdmin) {
      const fullName = clean(formData.get("full_name"));
      const email = String(clean(formData.get("email")) || "").toLowerCase();
      const password = cleanPassword(formData.get("password"));
      const role = String(formData.get("role") || "viewer");

      if (!fullName || fullName.length < 3) {
        errorMessage = "Informe o nome completo do usuário.";
      } else if (!email || !email.includes("@")) {
        errorMessage = "Informe um e-mail válido.";
      } else if (!password || password.length < 8) {
        errorMessage = "Informe uma senha inicial com pelo menos 8 caracteres.";
      } else if (!isValidRole(role)) {
        errorMessage = "Perfil de usuário inválido.";
      }

      if (!errorMessage) {
        const admin = createAdminClient();
        const { data: authUser, error: authError } =
          await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName || "" },
          });

        if (authError || !authUser.user) {
          errorMessage =
            authError?.message ||
            "Não foi possível criar o usuário no Supabase Auth.";
        } else {
          const { error: profileError } = await admin.from("profiles").upsert({
            id: authUser.user.id,
            full_name: fullName,
            email,
            role,
            status: "active",
          });

          if (profileError) errorMessage = profileError.message;
        }
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível criar o usuário. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidatePath(path);
  redirect(successTarget(path, "Usuário criado com sucesso."));
}

export async function updateSystemUserAction(formData: FormData) {
  const path = "/cadastros/usuarios";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    if (!currentAdmin) {
      errorMessage = "Apenas administradores podem alterar perfis do sistema.";
    } else {
      errorMessage = await validateUserManagementGate(currentAdmin);
    }

    if (!errorMessage && currentAdmin) {
      const id = String(formData.get("id") || "");
      const fullName = clean(formData.get("full_name"));
      const email = String(clean(formData.get("email")) || "").toLowerCase();
      const password = cleanPassword(formData.get("password"));
      const role = String(formData.get("role") || "viewer");
      const status = String(formData.get("status") || "active");

      if (!id) {
        errorMessage = "Usuário não identificado.";
      } else if (!fullName || fullName.length < 3) {
        errorMessage = "Informe o nome completo do usuário.";
      } else if (!email || !email.includes("@")) {
        errorMessage = "Informe um e-mail válido.";
      } else if (password && password.length < 8) {
        errorMessage = "A nova senha deve ter pelo menos 8 caracteres.";
      } else if (!isValidRole(role) || !isValidStatus(status)) {
        errorMessage = "Perfil ou status inválido.";
      } else if (
        id === currentAdmin.id &&
        (role !== "admin" || status !== "active")
      ) {
        errorMessage =
          "Por segurança, o administrador logado não pode remover o próprio acesso.";
      }

      if (!errorMessage) {
        const admin = createAdminClient();

        if (!errorMessage) {
          const authPayload: {
            email: string;
            password?: string;
            user_metadata: { full_name: string };
          } = {
            email,
            user_metadata: { full_name: fullName || "" },
          };

          if (password) authPayload.password = password;

          const { error: authError } = await admin.auth.admin.updateUserById(
            id,
            authPayload,
          );

          if (authError) {
            errorMessage = authError.message;
          } else {
            const { error } = await admin
              .from("profiles")
              .update({ full_name: fullName || "", email, role, status })
              .eq("id", id);
            if (error) errorMessage = error.message;
          }
        }
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar o usuário. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidatePath(path);
  redirect(successTarget(path, "Usuário atualizado com sucesso."));
}

export async function deleteSystemUserAction(formData: FormData) {
  const path = "/cadastros/usuarios";
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await getCurrentAdminProfile();
    if (!currentAdmin) {
      errorMessage =
        "Apenas administradores podem excluir usuários do sistema.";
    } else {
      errorMessage = await validateUserManagementGate(currentAdmin);
    }

    if (!errorMessage && currentAdmin) {
      const id = String(formData.get("id") || "");
      const confirmDelete =
        String(formData.get("confirm_delete") || "") === "1";

      if (!id) {
        errorMessage = "Usuário não identificado.";
      } else if (id === currentAdmin.id) {
        errorMessage =
          "Por segurança, o administrador logado não pode excluir o próprio usuário.";
      } else if (!confirmDelete) {
        errorMessage = "Confirme a exclusão do usuário antes de continuar.";
      }

      if (!errorMessage) {
        const admin = createAdminClient();

        if (!errorMessage) {
          const { error: authError } = await admin.auth.admin.deleteUser(id);
          if (
            authError &&
            !authError.message.toLowerCase().includes("not found")
          ) {
            errorMessage = authError.message;
          } else {
            const { error: profileError } = await admin
              .from("profiles")
              .delete()
              .eq("id", id);
            if (profileError) errorMessage = profileError.message;
          }
        }
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o usuário. Confira a chave service role no servidor.";
  }

  if (errorMessage) redirect(target(path, errorMessage));
  revalidatePath(path);
  redirect(successTarget(path, "Usuário excluído com sucesso."));
}
