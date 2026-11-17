-- ==============================================================================
-- SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
-- Script de Base de Datos para Supabase (PostgreSQL)
-- Versión: 1.0.0
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLAS PRINCIPALES
-- ==============================================================================

-- 2.1 TABLA DE PERFILES DE USUARIO (Vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 TABLA DE PRODUCTOS (Catálogo maestro de referencias comerciales)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_code TEXT NOT NULL,           -- Código interno o familia (ej. AF-100, OSVK-704)
    part_number TEXT NOT NULL,             -- Part Number original (ej. 1613610500)
    description TEXT NOT NULL,             -- Descripción del producto (ej. Filtro de Aceite)
    category TEXT DEFAULT 'Repuestos',     -- Categoría (ej. Filtros, Válvulas, Kits)
    brand TEXT,                            -- Marca o fabricante (ej. Atlas Copco, Sullair, etc.)
    unit_of_measure TEXT DEFAULT 'UND',    -- Unidad de medida (UND, JGO, METRO)
    min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0), -- Stock mínimo de alerta
    warehouse_location TEXT,               -- Ubicación en almacén (ej. Estante A-2, Nivel 3)
    notes TEXT,                            -- Observaciones
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_part_number UNIQUE (part_number)
);

-- 2.3 TABLA DE UNIDADES FÍSICAS (Stickers con códigos alfanuméricos individuales)
CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    unit_code TEXT NOT NULL,               -- Código único impreso en sticker (ej. AF-100-00001)
    status TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK (status IN ('DISPONIBLE', 'RETIRADO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_unit_code UNIQUE (unit_code)
);

-- 2.4 TABLA DE MOVIMIENTOS HISTÓRICOS (Trazabilidad cronológica inmutable)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.inventory_units(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    unit_code TEXT NOT NULL,               -- Guardado directo para consultas rápidas
    movement_type TEXT NOT NULL CHECK (movement_type IN ('INGRESO', 'SALIDA', 'DEVOLUCION')),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1), -- Siempre 1 unidad por sticker
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    worker_name TEXT,                      -- Trabajador que retira / entrega (Opcional)
    client_name TEXT,                      -- Cliente asignado (Opcional)
    equipment_model TEXT,                  -- Equipo o modelo destino (Opcional)
    equipment_serial TEXT,                 -- Número de serie del equipo (Opcional)
    reason TEXT,                           -- Motivo de salida / devolución (Opcional)
    supplier TEXT,                         -- Proveedor / Procedencia (Opcional, para ingresos)
    document_reference TEXT,               -- Nro Guía / Orden de Compra (Opcional)
    notes TEXT,                            -- Observaciones adicionales (Opcional)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. ÍNDICES DE RENDIMIENTO
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_products_internal_code ON public.products(internal_code);
CREATE INDEX IF NOT EXISTS idx_products_part_number ON public.products(part_number);
CREATE INDEX IF NOT EXISTS idx_inventory_units_product_id ON public.inventory_units(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_status ON public.inventory_units(status);
CREATE INDEX IF NOT EXISTS idx_inventory_units_unit_code ON public.inventory_units(unit_code);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_unit_code ON public.inventory_movements(unit_code);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(movement_type);

-- ==============================================================================
-- 4. VISTA RESUMEN DE STOCK Y ALERTAS POR PRODUCTO
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_product_stock_summary AS
SELECT 
    p.id AS product_id,
    p.internal_code,
    p.part_number,
    p.description,
    p.category,
    p.brand,
    p.unit_of_measure,
    p.min_stock,
    p.warehouse_location,
    COUNT(u.id) AS total_registered_units,
    COUNT(CASE WHEN u.status = 'DISPONIBLE' THEN 1 END) AS available_units,
    COUNT(CASE WHEN u.status = 'RETIRADO' THEN 1 END) AS withdrawn_units,
    CASE 
        WHEN COUNT(CASE WHEN u.status = 'DISPONIBLE' THEN 1 END) = 0 THEN 'AGOTADO'
        WHEN COUNT(CASE WHEN u.status = 'DISPONIBLE' THEN 1 END) <= p.min_stock * 0.5 THEN 'CRITICO'
        WHEN COUNT(CASE WHEN u.status = 'DISPONIBLE' THEN 1 END) <= p.min_stock THEN 'PROXIMO'
        ELSE 'NORMAL'
    END AS stock_status,
    GREATEST(0, p.min_stock - COUNT(CASE WHEN u.status = 'DISPONIBLE' THEN 1 END)) AS suggested_replenishment
FROM public.products p
LEFT JOIN public.inventory_units u ON p.id = u.product_id
GROUP BY p.id;

-- ==============================================================================
-- 5. FUNCIONES Y DISPARADORES (TRIGGERS)
-- ==============================================================================

-- Función para actualizar campo updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_inventory_units_updated_at
BEFORE UPDATE ON public.inventory_units
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Función para crear perfil automáticamente al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_count INTEGER;
    initial_role TEXT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    -- El primer usuario registrado se convierte en admin automáticamente
    IF user_count = 0 THEN
        initial_role := 'admin';
    ELSE
        initial_role := 'operador';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        initial_role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 6. OPERACIONES TRANSACCIONALES ATÓMICAS (RPC)
-- ==============================================================================

-- 6.1 RPC: REGISTRAR INGRESO DE UNIDAD INDIVIDUAL
CREATE OR REPLACE FUNCTION public.register_unit_entry(
    p_product_id UUID,
    p_unit_code TEXT,
    p_supplier TEXT DEFAULT NULL,
    p_document_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_clean_code TEXT;
    v_existing_id UUID;
    v_unit_id UUID;
    v_product RECORD;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    -- Limpieza y estandarización del código (Mayúsculas sin espacios extremos)
    v_clean_code := UPPER(TRIM(p_unit_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RETURN json_build_object('success', false, 'error', 'El código de sticker no puede estar vacío.');
    END IF;

    -- Validar existencia del producto
    SELECT id, internal_code, part_number, description INTO v_product
    FROM public.products WHERE id = p_product_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'El producto seleccionado no existe en el catálogo.');
    END IF;

    -- Validar unicidad física del código individual
    SELECT id INTO v_existing_id FROM public.inventory_units WHERE unit_code = v_clean_code;
    IF v_existing_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'EL CÓDIGO YA EXISTE. No se permite duplicar códigos físicos individuales.'
        );
    END IF;

    -- Identificar usuario actual
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Insertar unidad física
    INSERT INTO public.inventory_units (product_id, unit_code, status)
    VALUES (p_product_id, v_clean_code, 'DISPONIBLE')
    RETURNING id INTO v_unit_id;

    -- Registrar movimiento inmutable de INGRESO
    INSERT INTO public.inventory_movements (
        unit_id,
        product_id,
        unit_code,
        movement_type,
        quantity,
        user_id,
        user_email,
        supplier,
        document_reference,
        notes
    ) VALUES (
        v_unit_id,
        p_product_id,
        v_clean_code,
        'INGRESO',
        1,
        v_user_id,
        v_user_email,
        p_supplier,
        p_document_reference,
        p_notes
    );

    RETURN json_build_object(
        'success', true,
        'unit_id', v_unit_id,
        'unit_code', v_clean_code,
        'product', v_product.description,
        'part_number', v_product.part_number,
        'message', 'Unidad ingresada correctamente con estado DISPONIBLE.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6.2 RPC: CONSULTAR ESTADO DE UNIDAD ANTES DE SALIDA (Para OCR / Entrada manual)
CREATE OR REPLACE FUNCTION public.lookup_unit_for_exit(p_unit_code TEXT)
RETURNS JSON AS $$
DECLARE
    v_clean_code TEXT;
    v_unit RECORD;
BEGIN
    v_clean_code := UPPER(TRIM(p_unit_code));

    SELECT 
        u.id AS unit_id,
        u.unit_code,
        u.status,
        u.product_id,
        p.internal_code,
        p.part_number,
        p.description,
        p.category,
        p.warehouse_location
    INTO v_unit
    FROM public.inventory_units u
    JOIN public.products p ON u.product_id = p.id
    WHERE u.unit_code = v_clean_code;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'found', false,
            'error', 'CÓDIGO NO REGISTRADO EN EL INVENTARIO.'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'found', true,
        'unit_id', v_unit.unit_id,
        'unit_code', v_unit.unit_code,
        'status', v_unit.status,
        'product_id', v_unit.product_id,
        'internal_code', v_unit.internal_code,
        'part_number', v_unit.part_number,
        'description', v_unit.description,
        'category', v_unit.category,
        'warehouse_location', v_unit.warehouse_location,
        'is_available', (v_unit.status = 'DISPONIBLE')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 6.3 RPC: REGISTRAR SALIDA ATÓMICA DE UNIDAD
CREATE OR REPLACE FUNCTION public.register_unit_exit(
    p_unit_code TEXT,
    p_worker_name TEXT DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_equipment_model TEXT DEFAULT NULL,
    p_equipment_serial TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_clean_code TEXT;
    v_unit RECORD;
    v_user_id UUID;
    v_user_email TEXT;
    v_movement_id UUID;
BEGIN
    v_clean_code := UPPER(TRIM(p_unit_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RETURN json_build_object('success', false, 'error', 'Debe proporcionar un código de unidad.');
    END IF;

    -- Bloqueo pesimista con FOR UPDATE para evitar salidas dobles o condiciones de carrera concurrentes
    SELECT 
        u.id, 
        u.unit_code, 
        u.status, 
        u.product_id,
        p.part_number,
        p.description
    INTO v_unit
    FROM public.inventory_units u
    JOIN public.products p ON u.product_id = p.id
    WHERE u.unit_code = v_clean_code
    FOR UPDATE OF u;

    -- Validación 1: El código existe?
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'CÓDIGO NO REGISTRADO EN EL INVENTARIO.'
        );
    END IF;

    -- Validación 2: Ya fue retirado?
    IF v_unit.status = 'RETIRADO' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'ESTE PRODUCTO YA FUE RETIRADO. NO SE PUEDE REGISTRAR OTRA SALIDA.'
        );
    END IF;

    -- Validación 3: Debe estar en estado DISPONIBLE
    IF v_unit.status <> 'DISPONIBLE' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'LA UNIDAD NO ESTÁ DISPONIBLE PARA SALIDA (Estado: ' || v_unit.status || ').'
        );
    END IF;

    -- Obtener usuario autenticado
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Actualizar estado de la unidad a RETIRADO
    UPDATE public.inventory_units
    SET status = 'RETIRADO',
        updated_at = NOW()
    WHERE id = v_unit.id;

    -- Registrar movimiento inmutable de SALIDA
    INSERT INTO public.inventory_movements (
        unit_id,
        product_id,
        unit_code,
        movement_type,
        quantity,
        user_id,
        user_email,
        worker_name,
        client_name,
        equipment_model,
        equipment_serial,
        reason,
        notes
    ) VALUES (
        v_unit.id,
        v_unit.product_id,
        v_clean_code,
        'SALIDA',
        1,
        v_user_id,
        v_user_email,
        p_worker_name,
        p_client_name,
        p_equipment_model,
        p_equipment_serial,
        p_reason,
        p_notes
    )
    RETURNING id INTO v_movement_id;

    RETURN json_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'unit_code', v_clean_code,
        'description', v_unit.description,
        'part_number', v_unit.part_number,
        'worker_name', p_worker_name,
        'timestamp', NOW(),
        'message', 'Salida registrada exitosamente.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6.4 RPC: REGISTRAR DEVOLUCIÓN DE UNIDAD
CREATE OR REPLACE FUNCTION public.register_unit_return(
    p_unit_code TEXT,
    p_worker_name TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_clean_code TEXT;
    v_unit RECORD;
    v_user_id UUID;
    v_user_email TEXT;
    v_movement_id UUID;
BEGIN
    v_clean_code := UPPER(TRIM(p_unit_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RETURN json_build_object('success', false, 'error', 'Debe proporcionar un código de unidad.');
    END IF;

    -- Bloqueo pesimista
    SELECT 
        u.id, 
        u.unit_code, 
        u.status, 
        u.product_id,
        p.part_number,
        p.description
    INTO v_unit
    FROM public.inventory_units u
    JOIN public.products p ON u.product_id = p.id
    WHERE u.unit_code = v_clean_code
    FOR UPDATE OF u;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'CÓDIGO NO REGISTRADO EN EL INVENTARIO.'
        );
    END IF;

    -- Solo se puede devolver una unidad previamente RETIRADA
    IF v_unit.status <> 'RETIRADO' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'LA UNIDAD NO ESTÁ RETIRADA. Actualmente se encuentra con estado: ' || v_unit.status
        );
    END IF;

    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Revertir estado a DISPONIBLE
    UPDATE public.inventory_units
    SET status = 'DISPONIBLE',
        updated_at = NOW()
    WHERE id = v_unit.id;

    -- Insertar nuevo movimiento de DEVOLUCION (conservando toda la trazabilidad anterior)
    INSERT INTO public.inventory_movements (
        unit_id,
        product_id,
        unit_code,
        movement_type,
        quantity,
        user_id,
        user_email,
        worker_name,
        reason,
        notes
    ) VALUES (
        v_unit.id,
        v_unit.product_id,
        v_clean_code,
        'DEVOLUCION',
        1,
        v_user_id,
        v_user_email,
        p_worker_name,
        p_reason,
        p_notes
    )
    RETURNING id INTO v_movement_id;

    RETURN json_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'unit_code', v_clean_code,
        'description', v_unit.description,
        'part_number', v_unit.part_number,
        'message', 'Devolución registrada exitosamente. La unidad vuelve a estar DISPONIBLE.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 7. SEGURIDAD Y ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Helper: Comprobar si el usuario actual es administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7.1 Políticas para PROFILES
CREATE POLICY "Usuarios autenticados pueden ver perfiles" 
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo admin o el propio usuario pueden editar perfiles" 
ON public.profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- 7.2 Políticas para PRODUCTS (Catálogo Maestro)
CREATE POLICY "Usuarios autenticados pueden consultar productos" 
ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden crear o importar productos" 
ON public.products FOR INSERT TO authenticated 
WITH CHECK (public.is_admin());

CREATE POLICY "Solo administradores pueden actualizar productos o stock minimo" 
ON public.products FOR UPDATE TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Solo administradores pueden eliminar productos" 
ON public.products FOR DELETE TO authenticated 
USING (public.is_admin());

-- 7.3 Políticas para INVENTORY_UNITS (Unidades Físicas)
CREATE POLICY "Usuarios autenticados pueden consultar unidades" 
ON public.inventory_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden registrar unidades" 
ON public.inventory_units FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar estado de unidades" 
ON public.inventory_units FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

-- No se permite DELETE directo sobre inventory_units para evitar huérfanos históricos

-- 7.4 Políticas para INVENTORY_MOVEMENTS (Historial Inmutable)
CREATE POLICY "Usuarios autenticados pueden consultar movimientos" 
ON public.inventory_movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar movimientos" 
ON public.inventory_movements FOR INSERT TO authenticated 
WITH CHECK (true);

-- REGLA DE SEGURIDAD CRÍTICA:
-- NO existen políticas de UPDATE ni DELETE para inventory_movements.
-- El historial de almacén es completamente inmutable.
