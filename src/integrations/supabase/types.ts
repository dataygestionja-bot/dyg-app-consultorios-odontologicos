export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      atenciones: {
        Row: {
          created_at: string
          diagnostico: string | null
          fecha: string
          id: string
          indicaciones: string | null
          motivo: string | null
          observaciones: string | null
          paciente_id: string
          profesional_id: string
          tratamiento_realizado: string | null
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diagnostico?: string | null
          fecha?: string
          id?: string
          indicaciones?: string | null
          motivo?: string | null
          observaciones?: string | null
          paciente_id: string
          profesional_id: string
          tratamiento_realizado?: string | null
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diagnostico?: string | null
          fecha?: string
          id?: string
          indicaciones?: string | null
          motivo?: string | null
          observaciones?: string | null
          paciente_id?: string
          profesional_id?: string
          tratamiento_realizado?: string | null
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atenciones_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atenciones_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profesionales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atenciones_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          accion: string
          created_at: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          descripcion: string | null
          entidad: string
          entidad_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          descripcion?: string | null
          entidad: string
          entidad_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          descripcion?: string | null
          entidad?: string
          entidad_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cobro_aplicaciones: {
        Row: {
          atencion_id: string | null
          cobro_id: string
          created_at: string
          id: string
          importe_aplicado: number
          presupuesto_id: string | null
        }
        Insert: {
          atencion_id?: string | null
          cobro_id: string
          created_at?: string
          id?: string
          importe_aplicado: number
          presupuesto_id?: string | null
        }
        Update: {
          atencion_id?: string | null
          cobro_id?: string
          created_at?: string
          id?: string
          importe_aplicado?: number
          presupuesto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobro_aplicaciones_atencion_id_fkey"
            columns: ["atencion_id"]
            isOneToOne: false
            referencedRelation: "atenciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobro_aplicaciones_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobro_aplicaciones_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros: {
        Row: {
          created_at: string
          fecha: string
          id: string
          importe: number
          medio_pago: Database["public"]["Enums"]["medio_pago"]
          observaciones: string | null
          paciente_id: string
          referencia: string | null
          updated_at: string
          usuario_registro: string | null
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          importe: number
          medio_pago?: Database["public"]["Enums"]["medio_pago"]
          observaciones?: string | null
          paciente_id: string
          referencia?: string | null
          updated_at?: string
          usuario_registro?: string | null
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          importe?: number
          medio_pago?: Database["public"]["Enums"]["medio_pago"]
          observaciones?: string | null
          paciente_id?: string
          referencia?: string | null
          updated_at?: string
          usuario_registro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_profesional: {
        Row: {
          activo: boolean
          created_at: string
          dia_semana: number
          duracion_slot_min: number
          hora_fin: string
          hora_inicio: string
          id: string
          profesional_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          dia_semana: number
          duracion_slot_min?: number
          hora_fin: string
          hora_inicio: string
          id?: string
          profesional_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          dia_semana?: number
          duracion_slot_min?: number
          hora_fin?: string
          hora_inicio?: string
          id?: string
          profesional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_profesional_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profesionales"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          exitoso: boolean
          id: string
          ip_address: string | null
          motivo: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          exitoso: boolean
          id?: string
          ip_address?: string | null
          motivo?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          exitoso?: boolean
          id?: string
          ip_address?: string | null
          motivo?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      obras_sociales: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          activo: boolean
          alergias: string | null
          antecedentes_medicos: string | null
          apellido: string
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          created_at: string
          dni: string
          domicilio: string | null
          email: string | null
          fecha_nacimiento: string | null
          id: string
          localidad: string | null
          medicacion_actual: string | null
          nombre: string
          numero_afiliado: string | null
          obra_social_id: string | null
          observaciones: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alergias?: string | null
          antecedentes_medicos?: string | null
          apellido: string
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          created_at?: string
          dni: string
          domicilio?: string | null
          email?: string | null
          fecha_nacimiento?: string | null
          id?: string
          localidad?: string | null
          medicacion_actual?: string | null
          nombre: string
          numero_afiliado?: string | null
          obra_social_id?: string | null
          observaciones?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alergias?: string | null
          antecedentes_medicos?: string | null
          apellido?: string
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          created_at?: string
          dni?: string
          domicilio?: string | null
          email?: string | null
          fecha_nacimiento?: string | null
          id?: string
          localidad?: string | null
          medicacion_actual?: string | null
          nombre?: string
          numero_afiliado?: string | null
          obra_social_id?: string | null
          observaciones?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      prestaciones: {
        Row: {
          activo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          descripcion: string
          duracion_estimada_min: number
          id: string
          precio_base: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          descripcion: string
          duracion_estimada_min?: number
          id?: string
          precio_base?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          descripcion?: string
          duracion_estimada_min?: number
          id?: string
          precio_base?: number
          updated_at?: string
        }
        Relationships: []
      }
      presupuesto_detalle: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          pieza_dental: string | null
          precio_unitario: number
          prestacion_id: string
          presupuesto_id: string
          subtotal: number | null
        }
        Insert: {
          cantidad?: number
          created_at?: string
          id?: string
          pieza_dental?: string | null
          precio_unitario?: number
          prestacion_id: string
          presupuesto_id: string
          subtotal?: number | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          pieza_dental?: string | null
          precio_unitario?: number
          prestacion_id?: string
          presupuesto_id?: string
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_detalle_prestacion_id_fkey"
            columns: ["prestacion_id"]
            isOneToOne: false
            referencedRelation: "prestaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_detalle_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["presupuesto_estado"]
          fecha: string
          id: string
          observaciones: string | null
          paciente_id: string
          profesional_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["presupuesto_estado"]
          fecha?: string
          id?: string
          observaciones?: string | null
          paciente_id: string
          profesional_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["presupuesto_estado"]
          fecha?: string
          id?: string
          observaciones?: string | null
          paciente_id?: string
          profesional_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profesionales"
            referencedColumns: ["id"]
          },
        ]
      }
      profesionales: {
        Row: {
          activo: boolean
          apellido: string
          color_agenda: string
          created_at: string
          email: string | null
          especialidad: string | null
          id: string
          matricula: string | null
          nombre: string
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          apellido: string
          color_agenda?: string
          created_at?: string
          email?: string | null
          especialidad?: string | null
          id?: string
          matricula?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          apellido?: string
          color_agenda?: string
          created_at?: string
          email?: string | null
          especialidad?: string | null
          id?: string
          matricula?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellido: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      turnos: {
        Row: {
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["turno_estado"]
          fecha: string
          hora_fin: string
          hora_inicio: string
          id: string
          motivo_consulta: string | null
          paciente_id: string
          profesional_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["turno_estado"]
          fecha: string
          hora_fin: string
          hora_inicio: string
          id?: string
          motivo_consulta?: string | null
          paciente_id: string
          profesional_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["turno_estado"]
          fecha?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          motivo_consulta?: string | null
          paciente_id?: string
          profesional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profesionales"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _accion: string
          _descripcion?: string
          _entidad: string
          _entidad_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "recepcion" | "profesional"
      medio_pago:
        | "efectivo"
        | "transferencia"
        | "debito"
        | "credito"
        | "mercadopago"
        | "otro"
      presupuesto_estado:
        | "borrador"
        | "entregado"
        | "aceptado"
        | "rechazado"
        | "parcialmente_ejecutado"
        | "finalizado"
      turno_estado:
        | "reservado"
        | "confirmado"
        | "atendido"
        | "cancelado"
        | "ausente"
        | "reprogramado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "recepcion", "profesional"],
      medio_pago: [
        "efectivo",
        "transferencia",
        "debito",
        "credito",
        "mercadopago",
        "otro",
      ],
      presupuesto_estado: [
        "borrador",
        "entregado",
        "aceptado",
        "rechazado",
        "parcialmente_ejecutado",
        "finalizado",
      ],
      turno_estado: [
        "reservado",
        "confirmado",
        "atendido",
        "cancelado",
        "ausente",
        "reprogramado",
      ],
    },
  },
} as const
