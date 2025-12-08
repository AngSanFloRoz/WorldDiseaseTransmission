// ================================
// CLASES DEL MODELO DE DATOS
// ================================

class Pais {
    constructor(id, nombre, poblacionTotal, latitud, longitud) {
        this.id = id;
        this.nombre = nombre;
        this.coordenadas = { latitud, longitud };
        this.estadoPoblacion = {
            total: poblacionTotal * 1000000, // Convertir millones a unidades
            susceptible: poblacionTotal * 1000000,
            infectada: 0,
            recuperada: 0,
            fallecida: 0
        };
        this.medidasVigentes = [];
        this.estadoInfeccioso = 'LIBRE'; // LIBRE, EXPUESTO, INFECTADO, RECUPERADO
        this.factorTransmision = 1.0;
    }

    actualizarEstado(nuevosValores) {
        // Asegurar que no haya valores negativos
        Object.keys(nuevosValores).forEach(key => {
            if (nuevosValores[key] < 0) {
                nuevosValores[key] = 0;
            }
        });
        
        // Asegurar que la suma no exceda la población total
        const suma = Object.values(nuevosValores).reduce((a, b) => a + b, 0);
        if (suma > this.estadoPoblacion.total) {
            // Normalizar para mantener total
            const factor = this.estadoPoblacion.total / suma;
            Object.keys(nuevosValores).forEach(key => {
                nuevosValores[key] = Math.floor(nuevosValores[key] * factor);
            });
        }
        
        Object.assign(this.estadoPoblacion, nuevosValores);
        
        // Actualizar estado infeccioso basado en porcentaje de infectados
        const porcentajeInfectado = (this.estadoPoblacion.infectada / this.estadoPoblacion.total) * 100;
        
        if (this.estadoPoblacion.infectada === 0) {
            if (this.estadoPoblacion.recuperada > 0 || this.estadoPoblacion.fallecida > 0) {
                this.estadoInfeccioso = 'RECUPERADO';
            } else {
                this.estadoInfeccioso = 'LIBRE';
            }
        } else if (porcentajeInfectado < 1) {
            this.estadoInfeccioso = 'EXPUESTO';
        } else {
            this.estadoInfeccioso = 'INFECTADO';
        }
    }

    aplicarMedida(medida) {
        if (!this.medidasVigentes.includes(medida)) {
            this.medidasVigentes.push(medida);
            this.calcularFactorTransmision();
        }
    }

    removerMedida(medida) {
        const index = this.medidasVigentes.indexOf(medida);
        if (index > -1) {
            this.medidasVigentes.splice(index, 1);
            this.calcularFactorTransmision();
        }
    }

    calcularFactorTransmision() {
        let factor = 1.0;
        
        this.medidasVigentes.forEach(medida => {
            switch(medida) {
                case 'cuarentena':
                    factor *= 0.3;
                    break;
                case 'cierre_fronteras':
                    factor *= 0.1;
                    break;
                case 'distanciamiento':
                    factor *= 0.6;
                    break;
                case 'mascarillas':
                    factor *= 0.8;
                    break;
            }
        });
        
        this.factorTransmision = Math.max(factor, 0.05);
        return this.factorTransmision;
    }

    getColorEstado() {
        const colores = {
            'LIBRE': '#4CAF50',
            'EXPUESTO': '#FFC107',
            'INFECTADO': '#F44336',
            'RECUPERADO': '#2196F3'
        };
        return colores[this.estadoInfeccioso] || '#757575';
    }
}

class RutaTransmision {
    constructor(idOrigen, idDestino, tipo, trafico = 0.5, distancia = 1000) {
        this.idOrigen = idOrigen;
        this.idDestino = idDestino;
        this.tipo = tipo; // AEREO, TERRESTRE, MARITIMO
        this.trafico = Math.min(Math.max(trafico, 0), 1); // Normalizado 0-1
        this.distancia = distancia;
        this.tiempoViajePromedio = this.calcularTiempoViaje();
        this.activa = true;
        this.bidireccional = true; // Todas las rutas son bidireccionales ahora
    }

    calcularTiempoViaje() {
        // Tiempo basado en distancia y tipo de ruta
        const velocidades = {
            'AEREO': 800, // km/h
            'TERRESTRE': 80,
            'MARITIMO': 40
        };
        return this.distancia / (velocidades[this.tipo] || 50);
    }

    calcularProbabilidadBase() {
        // Probabilidad base combina tráfico y distancia
        let probabilidad = this.trafico * 0.7 + (1 / (this.distancia / 1000 + 1)) * 0.3;
        
        // Ajustar por tipo de ruta
        const factoresTipo = {
            'AEREO': 0.9,
            'TERRESTRE': 0.7,
            'MARITIMO': 0.5
        };
        
        probabilidad *= factoresTipo[this.tipo] || 0.5;
        return Math.min(probabilidad, 0.95);
    }

    getColor() {
        const colores = {
            'AEREO': 'rgba(255, 0, 0, 0.6)',
            'TERRESTRE': 'rgba(0, 128, 0, 0.6)',
            'MARITIMO': 'rgba(0, 0, 255, 0.6)'
        };
        return colores[this.tipo] || 'rgba(100, 100, 100, 0.6)';
    }
}

class Enfermedad {
    constructor(nombre, tasaContagio, tasaMortalidad, tiempoRecuperacion, paisOrigen) {
        this.nombre = nombre;
        this.tasaContagio = tasaContagio / 100; // Convertir porcentaje a decimal
        this.tasaMortalidad = tasaMortalidad / 100;
        this.tiempoRecuperacion = tiempoRecuperacion;
        this.paisOrigen = paisOrigen;
        this.viaPrevaleciente = ['AEREO', 'TERRESTRE'];
        this.evolucionVias = {
            diasParaMaritimo: 30,
            diasParaTodas: 60
        };
        this.diasTranscurridos = 0;
    }

    evolucionar(dias = 1) {
        this.diasTranscurridos += dias;
        
        // Evolución de vías de transmisión
        if (this.diasTranscurridos >= this.evolucionVias.diasParaMaritimo && 
            !this.viaPrevaleciente.includes('MARITIMO')) {
            this.viaPrevaleciente.push('MARITIMO');
        }
        
        // Posible mutación (aumento de contagio)
        if (this.diasTranscurridos % 45 === 0) {
            this.tasaContagio *= 1.1; // Aumenta 10% cada 45 días
        }
    }

    generarGrafoProbabilistico(mundo) {
        const grafo = {
            nodos: [],
            aristas: []
        };
        
        // Agregar países como nodos
        mundo.paises.forEach(pais => {
            grafo.nodos.push({
                id: pais.id,
                nombre: pais.nombre,
                estado: pais.estadoInfeccioso,
                valor: pais.estadoPoblacion.infectada
            });
        });
        
        // Generar aristas con probabilidades
        mundo.rutas.forEach(ruta => {
            if (ruta.activa) {
                let probabilidad = ruta.calcularProbabilidadBase();
                
                // Ajustar por vías prevalentes
                if (this.viaPrevaleciente.includes(ruta.tipo)) {
                    probabilidad *= 1.5;
                }
                
                // Ajustar por tasa de contagio de la enfermedad
                probabilidad *= this.tasaContagio;
                
                // Ajustar por medidas en el país destino
                const paisDestino = mundo.obtenerPaisPorId(ruta.idDestino);
                if (paisDestino) {
                    probabilidad *= paisDestino.factorTransmision;
                }
                
                // Limitar probabilidad máxima
                probabilidad = Math.min(probabilidad, 0.99);
                
                grafo.aristas.push({
                    origen: ruta.idOrigen,
                    destino: ruta.idDestino,
                    tipo: ruta.tipo,
                    probabilidad: probabilidad,
                    distancia: ruta.distancia
                });
            }
        });
        
        return grafo;
    }
}

class Mundo {
    constructor() {
        this.paises = [];
        this.rutas = [];
        this.matrizAdyacencia = [];
        this.tablaPaises = new Map();
        this.tablaRutas = new Map();
        this.idCounter = 0;
        
        // Países iniciales de ejemplo
        this.inicializarPaisesEjemplo();
    }

    inicializarPaisesEjemplo() {
        const paisesEjemplo = [
            { nombre: "México", poblacion: 128.9, lat: 23.6345, lng: -102.5528 },
            { nombre: "Colombia", poblacion: 51.52, lat: 4.5709, lng: -74.2973 },
            { nombre: "Argentina", poblacion: 45.81, lat: -38.4161, lng: -63.6167 },
            { nombre: "Brasil", poblacion: 213.99, lat: -14.2350, lng: -51.9253 },
            { nombre: "Chile", poblacion: 19.12, lat: -35.6751, lng: -71.5429 },
            { nombre: "Perú", poblacion: 33.72, lat: -9.1900, lng: -75.0152 },
            { nombre: "Estados Unidos", poblacion: 331.9, lat: 37.0902, lng: -95.7129 },
            { nombre: "España", poblacion: 47.35, lat: 40.4637, lng: -3.7492 },
            { nombre: "China", poblacion: 1444.22, lat: 35.8617, lng: 104.1954 },
            { nombre: "India", poblacion: 1380.0, lat: 20.5937, lng: 78.9629 }
        ];
        
        paisesEjemplo.forEach(pais => {
            this.agregarPais(pais.nombre, pais.poblacion, pais.lat, pais.lng);
        });
        
        // Crear algunas rutas iniciales
        this.crearRutasAleatorias();
    }

    agregarPais(nombre, poblacion, latitud, longitud) {
        const id = this.idCounter++;
        const pais = new Pais(id, nombre, poblacion, latitud, longitud);
        
        this.paises.push(pais);
        this.tablaPaises.set(id, pais);
        
        // Expandir matriz
        for (let i = 0; i < this.matrizAdyacencia.length; i++) {
            this.matrizAdyacencia[i].push(0);
        }
        const nuevaFila = new Array(this.paises.length).fill(0);
        this.matrizAdyacencia.push(nuevaFila);
        
        return pais;
    }

    eliminarPais(id) {
        const index = this.paises.findIndex(p => p.id === id);
        if (index === -1) return false;
        
        // Eliminar de la lista
        this.paises.splice(index, 1);
        this.tablaPaises.delete(id);
        
        // Eliminar fila y columna de la matriz
        this.matrizAdyacencia.splice(index, 1);
        for (let i = 0; i < this.matrizAdyacencia.length; i++) {
            this.matrizAdyacencia[i].splice(index, 1);
        }
        
        // Eliminar rutas asociadas
        const rutasAEliminar = [];
        this.tablaRutas.forEach((ruta, key) => {
            if (ruta.idOrigen === id || ruta.idDestino === id) {
                rutasAEliminar.push(key);
            }
        });
        
        rutasAEliminar.forEach(key => {
            this.tablaRutas.delete(key);
        });
        
        this.rutas = Array.from(this.tablaRutas.values());
        
        return true;
    }

    agregarRuta(idOrigen, idDestino, tipo, trafico = 0.5) {
        const paisOrigen = this.obtenerPaisPorId(idOrigen);
        const paisDestino = this.obtenerPaisPorId(idDestino);
        
        if (!paisOrigen || !paisDestino || idOrigen === idDestino) {
            return null;
        }
        
        // Asegurar que idOrigen < idDestino para mantener consistencia
        const [menorId, mayorId] = idOrigen < idDestino ? 
            [idOrigen, idDestino] : [idDestino, idOrigen];
        
        // Calcular distancia aproximada
        const distancia = this.calcularDistancia(
            paisOrigen.coordenadas.latitud, paisOrigen.coordenadas.longitud,
            paisDestino.coordenadas.latitud, paisDestino.coordenadas.longitud
        );
        
        const ruta = new RutaTransmision(menorId, mayorId, tipo, trafico, distancia);
        const clave = `${menorId}-${mayorId}`;
        
        // Actualizar matriz simétricamente - RUTA BIDIRECCIONAL
        this.matrizAdyacencia[menorId][mayorId] = 1;
        this.matrizAdyacencia[mayorId][menorId] = 1;
        
        // Almacenar en tabla hash
        this.tablaRutas.set(clave, ruta);
        this.rutas.push(ruta);
        
        return ruta;
    }

    eliminarRuta(idOrigen, idDestino) {
        // Ordenar IDs para clave consistente
        const [menorId, mayorId] = idOrigen < idDestino ? 
            [idOrigen, idDestino] : [idDestino, idOrigen];
        const clave = `${menorId}-${mayorId}`;
        
        if (this.tablaRutas.has(clave)) {
            this.tablaRutas.delete(clave);
            // Actualizar matriz simétricamente - ELIMINAR BIDIRECCIONAL
            this.matrizAdyacencia[menorId][mayorId] = 0;
            this.matrizAdyacencia[mayorId][menorId] = 0;
            this.rutas = Array.from(this.tablaRutas.values());
            return true;
        }
        
        return false;
    }

    obtenerPaisPorNombre(nombre) {
        return this.paises.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    }

    obtenerPaisPorId(id) {
        return this.tablaPaises.get(id);
    }

    obtenerRutasDesde(paisId) {
        const rutasDesde = [];
        this.tablaRutas.forEach(ruta => {
            // Una ruta bidireccional puede ser origen o destino
            if ((ruta.idOrigen === paisId || ruta.idDestino === paisId) && ruta.activa) {
                // Determinar la dirección real
                const esOrigen = ruta.idOrigen === paisId;
                const otroPaisId = esOrigen ? ruta.idDestino : ruta.idOrigen;
                
                rutasDesde.push({
                    ...ruta,
                    direccion: esOrigen ? 'salida' : 'entrada',
                    paisConectadoId: otroPaisId
                });
            }
        });
        return rutasDesde;
    }

    obtenerRutasConectadas(paisId) {
        return this.obtenerRutasDesde(paisId);
    }

    obtenerMatrizVisualizacion() {
        const matriz = [];
        const encabezado = ['País', ...this.paises.map(p => p.nombre.substring(0, 3))];
        matriz.push(encabezado);
        
        this.paises.forEach((pais, i) => {
            const fila = [pais.nombre.substring(0, 10)];
            this.paises.forEach((_, j) => {
                if (j >= i) {
                    // Mostrar solo diagonal superior
                    fila.push(this.matrizAdyacencia[i][j] || 0);
                } else {
                    // Para diagonal inferior, mostrar "·" para indicar simetría
                    fila.push('·');
                }
            });
            matriz.push(fila);
        });
        
        return matriz;
    }

    actualizarMatrizDesdeUI(nuevaMatriz) {
        // Sincronizar cambios de la UI
        for (let i = 0; i < this.paises.length; i++) {
            for (let j = 0; j < this.paises.length; j++) {
                const valor = nuevaMatriz[i][j];
                const clave = `${i}-${j}`;
                
                if (valor === 1 && this.matrizAdyacencia[i][j] === 0) {
                    // Nueva ruta
                    const tipo = Math.random() > 0.5 ? 'AEREO' : 'TERRESTRE';
                    this.agregarRuta(i, j, tipo, Math.random());
                } else if (valor === 0 && this.matrizAdyacencia[i][j] === 1) {
                    // Eliminar ruta
                    this.eliminarRuta(i, j);
                }
            }
        }
    }

    calcularDistancia(lat1, lon1, lat2, lon2) {
        // Fórmula de Haversine simplificada
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    crearRutasAleatorias() {
        const tipos = ['AEREO', 'TERRESTRE', 'MARITIMO'];
        
        // Solo recorrer triángulo superior para evitar duplicados
        for (let i = 0; i < this.paises.length; i++) {
            for (let j = i + 1; j < this.paises.length; j++) {
                if (Math.random() > 0.7) {
                    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
                    this.agregarRuta(i, j, tipo, Math.random());
                }
            }
        }
    }
}

class Simulacion {
    constructor(mundo, enfermedad) {
        this.mundo = mundo;
        this.enfermedad = enfermedad;
        this.grafoProbabilistico = null;
        this.fechaActual = 0;
        this.configuracion = {
            velocidad: 5,
            pausada: true,
            propagacionInterna: true
        };
        this.historial = [];
        this.inicializar();
    }

    inicializar() {
        // Establecer país origen como infectado
        if (this.enfermedad.paisOrigen !== null) {
            const paisOrigen = this.mundo.obtenerPaisPorId(this.enfermedad.paisOrigen);
            if (paisOrigen) {
                const infectadosIniciales = Math.max(1000, paisOrigen.estadoPoblacion.total * 0.0001);
                paisOrigen.actualizarEstado({
                    susceptible: paisOrigen.estadoPoblacion.susceptible - infectadosIniciales,
                    infectada: infectadosIniciales
                });
            }
        }
        
        this.regenerarGrafo();
        this.guardarSnapshot();
    }

    regenerarGrafo() {
        this.grafoProbabilistico = this.enfermedad.generarGrafoProbabilistico(this.mundo);
    }

    avanzarUnDia() {
        if (this.configuracion.pausada) return;
        
        // Evolucionar enfermedad
        this.enfermedad.evolucionar(1);
        this.fechaActual++;
        
        // Regenerar grafo con nueva configuración
        this.regenerarGrafo();
        
        // Propagar dentro de cada país
        if (this.configuracion.propagacionInterna) {
            this.mundo.paises.forEach(pais => {
                this.propagarInternamente(pais);
            });
        }
        
        // Propagar entre países según grafo probabilístico
        this.propagarEntrePaises();
        
        // Actualizar recuperaciones y fallecimientos
        this.actualizarEstados();
        
        this.guardarSnapshot();
    }

    propagarInternamente(pais) {
        if (pais.estadoPoblacion.infectada === 0 || pais.estadoPoblacion.susceptible === 0) {
            return;
        }
        
        // Tasa de contacto base ajustada
        const tasaContactoBase = 8; // Reducida de 10 a 8
        
        // Probabilidad de contagio por contacto
        const probabilidadContagio = this.enfermedad.tasaContagio;
        
        // Factor por medidas del país
        const factorMedidas = pais.factorTransmision;
        
        // Densidad poblacional aproximada (infectados/total)
        const densidad = pais.estadoPoblacion.infectada / pais.estadoPoblacion.total;
        const factorDensidad = 0.3 + (densidad * 0.7); // Entre 0.3 y 1
        
        // Calcular nuevos infectados con límites más estrictos
        const contactosEfectivos = tasaContactoBase * pais.estadoPoblacion.infectada;
        const contactosConSusceptibles = contactosEfectivos * 
            (pais.estadoPoblacion.susceptible / pais.estadoPoblacion.total);
        
        let nuevosInfectados = Math.floor(
            contactosConSusceptibles * 
            probabilidadContagio * 
            factorMedidas * 
            factorDensidad
        );
        
        // Límites más estrictos
        nuevosInfectados = Math.max(nuevosInfectados, 0); // No negativo
        nuevosInfectados = Math.min(
            nuevosInfectados,
            pais.estadoPoblacion.susceptible,
            Math.ceil(pais.estadoPoblacion.susceptible * 0.1) // Máximo 10% de susceptibles por día
        );
        
        if (nuevosInfectados > 0) {
            pais.actualizarEstado({
                susceptible: pais.estadoPoblacion.susceptible - nuevosInfectados,
                infectada: pais.estadoPoblacion.infectada + nuevosInfectados
            });
        }
    }

    propagarEntrePaises() {
        this.grafoProbabilistico.aristas.forEach(arista => {
            // En una ruta bidireccional, la propagación puede ir en ambos sentidos
            const direcciones = [
                { origen: arista.origen, destino: arista.destino },
                { origen: arista.destino, destino: arista.origen }
            ];
            
            direcciones.forEach(dir => {
                const paisOrigen = this.mundo.obtenerPaisPorId(dir.origen);
                const paisDestino = this.mundo.obtenerPaisPorId(dir.destino);
                
                if (!paisOrigen || !paisDestino || paisOrigen.estadoPoblacion.infectada === 0) {
                    return;
                }
                
                // Calcular posibilidad de contagio (misma lógica que antes)
                const factorOrigen = paisOrigen.estadoPoblacion.infectada / paisOrigen.estadoPoblacion.total;
                const posibilidad = arista.probabilidad * factorOrigen * 0.7; // Reducir un poco por ser bidireccional
                
                if (Math.random() < posibilidad) {
                    // Contagio exitoso
                    const nuevosInfectados = Math.max(
                        1,
                        Math.floor(paisDestino.estadoPoblacion.susceptible * 0.001)
                    );
                    
                    if (nuevosInfectados > 0 && paisDestino.estadoPoblacion.susceptible > 0) {
                        paisDestino.actualizarEstado({
                            susceptible: paisDestino.estadoPoblacion.susceptible - nuevosInfectados,
                            infectada: paisDestino.estadoPoblacion.infectada + nuevosInfectados
                        });
                    }
                }
            });
        });
    }

    actualizarEstados() {
        this.mundo.paises.forEach(pais => {
            if (pais.estadoPoblacion.infectada > 0) {
                // Calcular recuperaciones BASADAS EN EL TIEMPO DE RECUPERACIÓN
                const diasParaRecuperar = this.enfermedad.tiempoRecuperacion;
                
                // Porcentaje de infectados que se recuperan/fallecen cada día
                const porcentajeDiario = 1 / diasParaRecuperar; // Ej: 1/14 = ~7% por día
                
                // Número de personas que cambian de estado hoy
                const cambioHoy = Math.ceil(pais.estadoPoblacion.infectada * porcentajeDiario);
                
                if (cambioHoy > 0) {
                    // Calcular cuántos fallecen y cuántos se recuperan
                    const fallecidos = Math.floor(cambioHoy * this.enfermedad.tasaMortalidad);
                    const recuperados = cambioHoy - fallecidos;
                    
                    // Asegurar que no haya números negativos
                    const infectadosRestantes = Math.max(0, pais.estadoPoblacion.infectada - cambioHoy);
                    const nuevosRecuperados = Math.min(recuperados, pais.estadoPoblacion.infectada - fallecidos);
                    const nuevosFallecidos = Math.min(fallecidos, pais.estadoPoblacion.infectada);
                    
                    // Actualizar estado
                    pais.actualizarEstado({
                        infectada: infectadosRestantes,
                        recuperada: pais.estadoPoblacion.recuperada + nuevosRecuperados,
                        fallecida: pais.estadoPoblacion.fallecida + nuevosFallecidos
                    });
                    
                    // Si ya no hay infectados, cambiar estado a RECUPERADO
                    if (pais.estadoPoblacion.infectada === 0 && pais.estadoPoblacion.recuperada > 0) {
                        pais.estadoInfeccioso = 'RECUPERADO';
                    }
                }
            }
        });
    }

    retrocederUnDia() {
        if (this.historial.length > 1) {
            this.historial.pop(); // Eliminar estado actual
            const estadoAnterior = this.historial[this.historial.length - 1];
            this.restaurarSnapshot(estadoAnterior);
            this.fechaActual--;
        }
    }

    guardarSnapshot() {
        const snapshot = {
            fecha: this.fechaActual,
            paises: this.mundo.paises.map(p => ({
                ...p,
                estadoPoblacion: { ...p.estadoPoblacion },
                medidasVigentes: [...p.medidasVigentes]
            }))
        };
        this.historial.push(snapshot);
    }

    restaurarSnapshot(snapshot) {
        this.fechaActual = snapshot.fecha;
        
        snapshot.paises.forEach(paisSnapshot => {
            const pais = this.mundo.obtenerPaisPorId(paisSnapshot.id);
            if (pais) {
                pais.estadoPoblacion = { ...paisSnapshot.estadoPoblacion };
                pais.medidasVigentes = [...paisSnapshot.medidasVigentes];
                pais.estadoInfeccioso = paisSnapshot.estadoInfeccioso;
                pais.calcularFactorTransmision();
            }
        });
    }

    obtenerEstadisticasGlobales() {
        let totalInfectados = 0;
        let totalFallecidos = 0;
        let paisesAfectados = 0;
        
        this.mundo.paises.forEach(pais => {
            totalInfectados += pais.estadoPoblacion.infectada;
            totalFallecidos += pais.estadoPoblacion.fallecida;
            
            if (pais.estadoPoblacion.infectada > 0) {
                paisesAfectados++;
            }
        });
        
        // Calcular tasa de propagación REAL basada en el crecimiento actual
        let tasaPropagacion = 0;
        if (this.historial.length > 1) {
            const estadoActual = this.historial[this.historial.length - 1];
            const estadoAnterior = this.historial[this.historial.length - 2];
            
            let infectadosActual = 0;
            let infectadosAnterior = 0;
            
            estadoActual.paises.forEach(p => infectadosActual += p.estadoPoblacion.infectada);
            estadoAnterior.paises.forEach(p => infectadosAnterior += p.estadoPoblacion.infectada);
            
            if (infectadosAnterior > 0) {
                tasaPropagacion = (infectadosActual - infectadosAnterior) / infectadosAnterior;
            }
        }
        
        return {
            totalInfectados,
            totalFallecidos,
            paisesAfectados,
            tasaPropagacion: tasaPropagacion // Ahora es una tasa porcentual
        };
    }
}

// ================================
// CONTROLADOR DE LA APLICACIÓN
// ================================

class ControladorAplicacion {
    constructor() {
        this.mundo = new Mundo();
        this.enfermedad = null;
        this.simulacion = null;
        this.intervaloSimulacion = null;
        this.paisSeleccionado = null;
        this.matrizVisible = true;
        this.rutaEditando = null; // {fila, columna, tipoActual}
        this.tipoRutaSeleccionado = null;
        
        this.inicializarUI();
        this.inicializarEventos();
        this.inicializarEventosTipoRuta();
        this.actualizarUI();
    }

    inicializarUI() {
        // Llenar lista de países
        this.actualizarListaPaises();
        
        // Llenar selector de país origen
        const selectOrigen = document.getElementById('paisOrigen');
        selectOrigen.innerHTML = '<option value="null">Seleccionar...</option>';
        this.mundo.paises.forEach(pais => {
            const option = document.createElement('option');
            option.value = pais.id;
            option.textContent = pais.nombre;
            selectOrigen.appendChild(option);
        });
        
        // Inicializar enfermedad por defecto
        this.enfermedad = new Enfermedad(
            document.getElementById('nombreEnfermedad').value,
            parseFloat(document.getElementById('tasaContagio').value),
            parseFloat(document.getElementById('tasaMortalidad').value),
            parseInt(document.getElementById('tiempoRecuperacion').value),
            null
        );
        
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        
        // Inicializar matriz visual
        this.generarMatrizVisual();
        
        // Dibujar mapa inicial
        this.dibujarMapa();
    }

    inicializarEventos() {
        // Controles de simulación
        document.getElementById('btnPlayPause').addEventListener('click', () => this.toggleSimulacion());
        document.getElementById('btnStep').addEventListener('click', () => this.avanzarPaso());
        document.getElementById('btnReset').addEventListener('click', () => this.reiniciarSimulacion());
        document.getElementById('velocidadSlider').addEventListener('input', (e) => this.ajustarVelocidad(e.target.value));
        
        // Configuración de enfermedad
        document.getElementById('tasaContagio').addEventListener('input', (e) => {
            document.getElementById('valorContagio').textContent = e.target.value + '%';
        });
        document.getElementById('tasaMortalidad').addEventListener('input', (e) => {
            document.getElementById('valorMortalidad').textContent = e.target.value + '%';
        });
        document.getElementById('btnAplicarEnfermedad').addEventListener('click', () => this.aplicarConfiguracionEnfermedad());
        
        // Gestión de países
        document.getElementById('btnAgregarPais').addEventListener('click', () => this.agregarPais());
        document.getElementById('btnEliminarPais').addEventListener('click', () => this.eliminarPaisSeleccionado());
        
        // Controles de matriz
        document.getElementById('btnToggleMatriz').addEventListener('click', () => this.toggleMatriz());
        document.getElementById('btnEditarMatriz').addEventListener('click', () => this.activarEdicionMatriz());
        
        // Análisis y predicciones
        document.getElementById('btnPredecir30').addEventListener('click', () => this.predecir30Dias());
        document.getElementById('btnPaisesRiesgo').addEventListener('click', () => this.identificarPaisesRiesgo());
        document.getElementById('btnRutasCriticas').addEventListener('click', () => this.identificarRutasCriticas());
        document.getElementById('btnFiltrarAereo').addEventListener('click', () => this.filtrarRutasAereas());
        
        // Canvas (clic en países)
        const canvas = document.getElementById('mapaCanvas');
        canvas.addEventListener('click', (e) => this.handleClicMapa(e));
        
        // Modal
        document.querySelector('.close-modal').addEventListener('click', () => this.cerrarModal());
        window.addEventListener('click', (e) => {
            if (e.target.id === 'modalPais') {
                this.cerrarModal();
            }
        });
    }

    inicializarEventosTipoRuta() {
        // Eventos para las opciones de tipo de ruta
        document.querySelectorAll('.tipo-ruta-opcion').forEach(opcion => {
            opcion.addEventListener('click', () => {
                // Deseleccionar todas
                document.querySelectorAll('.tipo-ruta-opcion').forEach(o => {
                    o.classList.remove('seleccionada');
                });
                
                // Seleccionar esta
                opcion.classList.add('seleccionada');
                this.tipoRutaSeleccionado = opcion.dataset.tipo;
                
                // Actualizar botón de eliminar si hay ruta existente
                const btnEliminar = document.getElementById('btnEliminarRuta');
                if (this.rutaEditando && this.rutaEditando.tipoActual) {
                    btnEliminar.style.display = 'inline-block';
                }
            });
        });
        
        // Evento para el botón eliminar ruta
        document.getElementById('btnEliminarRuta').addEventListener('click', () => {
            if (this.rutaEditando) {
                this.eliminarRutaDesdeModal();
            }
        });
    }

    // ========== MÉTODOS DE SIMULACIÓN ==========

    toggleSimulacion() {
        const btn = document.getElementById('btnPlayPause');
        const icon = btn.querySelector('i');
        
        this.simulacion.configuracion.pausada = !this.simulacion.configuracion.pausada;
        
        if (this.simulacion.configuracion.pausada) {
            btn.innerHTML = '<i class="fas fa-play"></i> Iniciar';
            clearInterval(this.intervaloSimulacion);
        } else {
            btn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            this.iniciarSimulacion();
        }
        
        document.getElementById('estadoSimulacion').textContent = 
            this.simulacion.configuracion.pausada ? 'Estado: Pausado' : 'Estado: Ejecutando';
    }

    iniciarSimulacion() {
        const velocidad = this.simulacion.configuracion.velocidad;
        const intervalo = 1000 / velocidad; // ms entre pasos
        
        clearInterval(this.intervaloSimulacion);
        this.intervaloSimulacion = setInterval(() => {
            this.simulacion.avanzarUnDia();
            this.actualizarUI();
        }, intervalo);
    }

    avanzarPaso() {
        this.simulacion.avanzarUnDia();
        this.actualizarUI();
    }

    reiniciarSimulacion() {
        clearInterval(this.intervaloSimulacion);
        
        // Crear nueva enfermedad
        this.enfermedad = new Enfermedad(
            document.getElementById('nombreEnfermedad').value,
            parseFloat(document.getElementById('tasaContagio').value),
            parseFloat(document.getElementById('tasaMortalidad').value),
            parseInt(document.getElementById('tiempoRecuperacion').value),
            parseInt(document.getElementById('paisOrigen').value)
        );
        
        // RESETEAR COMPLETAMENTE LOS PAÍSES
        this.mundo.paises.forEach(pais => {
            const poblacionTotal = pais.estadoPoblacion.total;
            
            // Reiniciar completamente el estado del país
            pais.estadoPoblacion = {
                total: poblacionTotal,
                susceptible: poblacionTotal,
                infectada: 0,
                recuperada: 0,
                fallecida: 0
            };
            pais.medidasVigentes = [];
            pais.estadoInfeccioso = 'LIBRE';
            pais.factorTransmision = 1.0;
        });
        
        // Establecer país origen como infectado SOLO si está seleccionado
        if (this.enfermedad.paisOrigen !== null && !isNaN(this.enfermedad.paisOrigen)) {
            const paisOrigen = this.mundo.obtenerPaisPorId(this.enfermedad.paisOrigen);
            if (paisOrigen) {
                const infectadosIniciales = Math.max(1000, paisOrigen.estadoPoblacion.total * 0.0001);
                paisOrigen.actualizarEstado({
                    susceptible: paisOrigen.estadoPoblacion.susceptible - infectadosIniciales,
                    infectada: infectadosIniciales
                });
                paisOrigen.estadoInfeccioso = 'INFECTADO';
            }
        }
        
        // Crear nueva simulación
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        
        // Actualizar UI
        document.getElementById('btnPlayPause').innerHTML = '<i class="fas fa-play"></i> Iniciar';
        document.getElementById('estadoSimulacion').textContent = 'Estado: Reiniciado';
        document.getElementById('fechaActual').textContent = 'Día: 0';
        
        this.actualizarUI();
    }

    ajustarVelocidad(valor) {
        this.simulacion.configuracion.velocidad = valor;
        
        if (!this.simulacion.configuracion.pausada) {
            this.iniciarSimulacion();
        }
    }

    // ========== MÉTODOS DE CONFIGURACIÓN ==========

    aplicarConfiguracionEnfermedad() {
        // Obtener vías seleccionadas
        const viasSeleccionadas = [];
        document.querySelectorAll('input[name="via"]:checked').forEach(checkbox => {
            viasSeleccionadas.push(checkbox.value);
        });
        
        // Actualizar enfermedad
        this.enfermedad.nombre = document.getElementById('nombreEnfermedad').value;
        this.enfermedad.tasaContagio = parseFloat(document.getElementById('tasaContagio').value) / 100;
        this.enfermedad.tasaMortalidad = parseFloat(document.getElementById('tasaMortalidad').value) / 100;
        this.enfermedad.tiempoRecuperacion = parseInt(document.getElementById('tiempoRecuperacion').value);
        this.enfermedad.paisOrigen = parseInt(document.getElementById('paisOrigen').value);
        this.enfermedad.viaPrevaleciente = viasSeleccionadas;
        
        // Reiniciar simulación con nueva enfermedad
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        
        this.actualizarUI();
        this.mostrarMensaje('Configuración de enfermedad aplicada correctamente');
    }

    agregarPais() {
        const nombre = document.getElementById('nombrePais').value.trim();
        const poblacion = parseFloat(document.getElementById('poblacionPais').value);
        
        if (!nombre || isNaN(poblacion) || poblacion <= 0) {
            this.mostrarMensaje('Error: Nombre y población son requeridos', true);
            return;
        }
        
        // Coordenadas aleatorias (en una región específica)
        const latitud = (Math.random() * 60) - 30; // Entre -30 y 30
        const longitud = (Math.random() * 120) - 80; // Entre -80 y 40
        
        this.mundo.agregarPais(nombre, poblacion, latitud, longitud);
        
        // Actualizar UI
        this.actualizarListaPaises();
        this.actualizarSelectorOrigen();
        this.generarMatrizVisual();
        this.dibujarMapa();
        
        // Limpiar campos
        document.getElementById('nombrePais').value = '';
        document.getElementById('poblacionPais').value = '50';
        
        this.mostrarMensaje(`País "${nombre}" agregado correctamente`);
    }

    eliminarPaisSeleccionado() {
        if (this.paisSeleccionado === null) {
            this.mostrarMensaje('Selecciona un país primero', true);
            return;
        }
        
        const nombre = this.mundo.obtenerPaisPorId(this.paisSeleccionado).nombre;
        const confirmado = confirm(`¿Eliminar el país "${nombre}" y todas sus rutas?`);
        
        if (confirmado) {
            this.mundo.eliminarPais(this.paisSeleccionado);
            this.paisSeleccionado = null;
            
            this.actualizarListaPaises();
            this.actualizarSelectorOrigen();
            this.generarMatrizVisual();
            this.dibujarMapa();
            
            this.mostrarMensaje(`País "${nombre}" eliminado correctamente`);
        }
    }

    // ========== MÉTODOS DE VISUALIZACIÓN ==========

    actualizarUI() {
        // Actualizar fecha
        document.getElementById('fechaActual').textContent = `Día: ${this.simulacion.fechaActual}`;
        
        // Actualizar estadísticas
        const stats = this.simulacion.obtenerEstadisticasGlobales();
        document.getElementById('totalInfectados').textContent = stats.totalInfectados.toLocaleString();
        document.getElementById('totalFallecidos').textContent = stats.totalFallecidos.toLocaleString();
        document.getElementById('paisesAfectados').textContent = stats.paisesAfectados;
        document.getElementById('tasaPropagacion').textContent = 
            `${(stats.tasaPropagacion * 100).toFixed(2)}%`;
        
        // Actualizar contadores
        document.getElementById('contadorPaises').textContent = `Países: ${this.mundo.paises.length}`;
        document.getElementById('contadorRutas').textContent = `Rutas: ${this.mundo.rutas.length}`;
        
        // Redibujar mapa
        this.dibujarMapa();
        
        // Actualizar lista de países
        this.actualizarListaPaises();
    }

    actualizarListaPaises() {
        const lista = document.getElementById('listaPaises');
        lista.innerHTML = '';
        
        this.mundo.paises.forEach(pais => {
            const item = document.createElement('div');
            item.className = `pais-item ${this.paisSeleccionado === pais.id ? 'seleccionado' : ''}`;
            item.dataset.id = pais.id;
            
            item.innerHTML = `
                <div class="pais-info">
                    <div class="estado-pais" style="background-color: ${pais.getColorEstado()}"></div>
                    <span>${pais.nombre}</span>
                </div>
                <div class="pais-estadisticas">
                    <small>${pais.estadoPoblacion.infectada.toLocaleString()} infectados</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.seleccionarPais(pais.id);
            });
            
            lista.appendChild(item);
        });
    }

    actualizarSelectorOrigen() {
        const select = document.getElementById('paisOrigen');
        const valorActual = select.value;
        
        select.innerHTML = '<option value="null">Seleccionar...</option>';
        this.mundo.paises.forEach(pais => {
            const option = document.createElement('option');
            option.value = pais.id;
            option.textContent = pais.nombre;
            if (parseInt(valorActual) === pais.id) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    seleccionarPais(id) {
        this.paisSeleccionado = id;
        this.actualizarListaPaises();
        
        // MOSTRAR INFORMACIÓN DETALLADA DEL PAÍS
        const pais = this.mundo.obtenerPaisPorId(id);
        if (pais) {
            this.mostrarInformacionPais(pais);
        }
    }

    mostrarInformacionPais(pais) {
        const porcentajeInfectado = (pais.estadoPoblacion.infectada / pais.estadoPoblacion.total) * 100;
        const porcentajeRecuperado = (pais.estadoPoblacion.recuperada / pais.estadoPoblacion.total) * 100;
        const porcentajeFallecido = (pais.estadoPoblacion.fallecida / pais.estadoPoblacion.total) * 100;
        const porcentajeSusceptible = (pais.estadoPoblacion.susceptible / pais.estadoPoblacion.total) * 100;
        
        document.getElementById('modalPaisTitulo').textContent = `Información: ${pais.nombre}`;
        document.getElementById('modalPaisContenido').innerHTML = `
            <div class="modal-stats">
                <div class="modal-stat">
                    <span class="modal-label">Población Total:</span>
                    <span class="modal-value">${Math.round(pais.estadoPoblacion.total / 1000000 * 100) / 100} millones</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">Susceptibles:</span>
                    <span class="modal-value" style="color: #4CAF50">${pais.estadoPoblacion.susceptible.toLocaleString()} (${porcentajeSusceptible.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">Infectados:</span>
                    <span class="modal-value" style="color: #F44336">${pais.estadoPoblacion.infectada.toLocaleString()} (${porcentajeInfectado.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">Recuperados:</span>
                    <span class="modal-value" style="color: #2196F3">${pais.estadoPoblacion.recuperada.toLocaleString()} (${porcentajeRecuperado.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">Fallecidos:</span>
                    <span class="modal-value">${pais.estadoPoblacion.fallecida.toLocaleString()} (${porcentajeFallecido.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">Estado:</span>
                    <span class="modal-value" style="color: ${pais.getColorEstado()}">${pais.estadoInfeccioso}</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">Factor Transmisión:</span>
                    <span class="modal-value">${pais.factorTransmision.toFixed(3)}</span>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>Medidas Vigentes:</h4>
                ${pais.medidasVigentes.length > 0 ? 
                    `<ul>${pais.medidasVigentes.map(m => `<li>${this.formatearMedida(m)}</li>`).join('')}</ul>` : 
                    '<p>No hay medidas activas</p>'}
            </div>
            
            <div class="modal-section">
                <h4>Conexiones con otros países:</h4>
                ${this.mundo.obtenerRutasConectadas(pais.id).length > 0 ? 
                    `<ul>${this.mundo.obtenerRutasConectadas(pais.id).map(r => {
                        const otroPais = this.mundo.obtenerPaisPorId(r.paisConectadoId || 
                            (r.idOrigen === pais.id ? r.idDestino : r.idOrigen));
                        const direccion = r.direccion === 'salida' ? '→' : '←';
                        const prob = (r.calcularProbabilidadBase() * 100).toFixed(1);
                        return `<li>${direccion} ${otroPais.nombre} (${r.tipo}, Prob: ${prob}%)</li>`;
                    }).join('')}</ul>` : 
                    '<p>No tiene conexiones activas</p>'}
            </div>
            
            <div class="modal-actions">
                <button class="btn-small" onclick="controlador.aplicarMedidaPais(${pais.id}, 'cuarentena')">Aplicar Cuarentena</button>
                <button class="btn-small" onclick="controlador.aplicarMedidaPais(${pais.id}, 'cierre_fronteras')">Cerrar Fronteras</button>
                <button class="btn-small" onclick="controlador.aplicarMedidaPais(${pais.id}, 'distanciamiento')">Distanciamiento</button>
                <button class="btn-small" onclick="controlador.aplicarMedidaPais(${pais.id}, 'mascarillas')">Uso de Mascarillas</button>
            </div>
        `;
        
        document.getElementById('modalPais').style.display = 'flex';
    }

    formatearMedida(medida) {
        const nombres = {
            'cuarentena': 'Cuarentena Total',
            'cierre_fronteras': 'Cierre de Fronteras',
            'distanciamiento': 'Distanciamiento Social',
            'mascarillas': 'Uso Obligatorio de Mascarillas'
        };
        return nombres[medida] || medida;
    }

    aplicarMedidaPais(id, medida) {
        const pais = this.mundo.obtenerPaisPorId(id);
        if (pais) {
            if (pais.medidasVigentes.includes(medida)) {
                pais.removerMedida(medida);
                this.mostrarMensaje(`Medida "${medida}" removida de ${pais.nombre}`);
            } else {
                pais.aplicarMedida(medida);
                this.mostrarMensaje(`Medida "${medida}" aplicada en ${pais.nombre}`);
            }
            this.actualizarUI();
        }
    }

    cerrarModal() {
        document.getElementById('modalPais').style.display = 'none';
    }

    // ========== MÉTODOS DEL MAPA ==========

    dibujarMapa(canvasId = 'mapaCanvas', soloAereas = false) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Escalar coordenadas al tamaño del canvas CON MÁRGENES
        const minLat = Math.min(...this.mundo.paises.map(p => p.coordenadas.latitud));
        const maxLat = Math.max(...this.mundo.paises.map(p => p.coordenadas.latitud));
        const minLng = Math.min(...this.mundo.paises.map(p => p.coordenadas.longitud));
        const maxLng = Math.max(...this.mundo.paises.map(p => p.coordenadas.longitud));
        
        // Agregar margen del 15% alrededor de los puntos
        const margen = 0.15;
        const rangoLat = maxLat - minLat;
        const rangoLng = maxLng - minLng;
        
        const minLatConMargen = minLat - (rangoLat * margen);
        const maxLatConMargen = maxLat + (rangoLat * margen);
        const minLngConMargen = minLng - (rangoLng * margen);
        const maxLngConMargen = maxLng + (rangoLng * margen);
        
        const escalaX = canvas.width / (maxLngConMargen - minLngConMargen);
        const escalaY = canvas.height / (maxLatConMargen - minLatConMargen);
        
        // Dibujar rutas primero
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
        
        const rutasADibujar = soloAereas ? 
            this.mundo.rutas.filter(r => r.tipo === 'AEREO' && r.activa) : 
            this.mundo.rutas;
        
        rutasADibujar.forEach(ruta => {
            const origen = this.mundo.obtenerPaisPorId(ruta.idOrigen);
            const destino = this.mundo.obtenerPaisPorId(ruta.idDestino);
            
            if (origen && destino && ruta.activa) {
                const x1 = (origen.coordenadas.longitud - minLngConMargen) * escalaX;
                const y1 = canvas.height - ((origen.coordenadas.latitud - minLatConMargen) * escalaY);
                const x2 = (destino.coordenadas.longitud - minLngConMargen) * escalaX;
                const y2 = canvas.height - ((destino.coordenadas.latitud - minLatConMargen) * escalaY);
                
                // Usar el color del tipo de ruta
                ctx.strokeStyle = ruta.getColor();
                ctx.lineWidth = soloAereas ? 3 : 2;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                
                // Añadir etiqueta del tipo en rutas importantes
                if (!soloAereas && ruta.distancia > 3000) {
                    const mitadX = (x1 + x2) / 2;
                    const mitadY = (y1 + y2) / 2;
                    
                    ctx.fillStyle = ruta.getColor();
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(ruta.tipo.charAt(0), mitadX, mitadY - 5);
                }
            }
        });
        
        // Dibujar países
        this.mundo.paises.forEach(pais => {
            const x = (pais.coordenadas.longitud - minLngConMargen) * escalaX;
            const y = canvas.height - ((pais.coordenadas.latitud - minLatConMargen) * escalaY);
            
            // Tamaño basado en población (logarítmico) con mínimo
            const radio = Math.max(8, 5 + Math.log10(pais.estadoPoblacion.total / 1000000) * 3);
            
            // Dibujar círculo
            ctx.fillStyle = pais.getColorEstado();
            ctx.beginPath();
            ctx.arc(x, y, radio, 0, Math.PI * 2);
            ctx.fill();
            
            // Borde si está seleccionado (solo en mapa principal)
            if (canvasId === 'mapaCanvas' && this.paisSeleccionado === pais.id) {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            // Nombre del país
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Solo mostrar nombre en mapa principal para no saturar
            if (canvasId === 'mapaCanvas') {
                ctx.fillText(pais.nombre, x, y - radio - 8);
            }
            
            // Mostrar número de infectados si hay
            if (pais.estadoPoblacion.infectada > 0 && canvasId === 'mapaCanvas') {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '10px Arial';
                ctx.fillText(
                    Math.round(pais.estadoPoblacion.infectada / 1000) + 'K', 
                    x, 
                    y + radio + 8
                );
            }
        });
    }

    handleClicMapa(event) {
        const canvas = document.getElementById('mapaCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Escalar coordenadas
        const minLat = Math.min(...this.mundo.paises.map(p => p.coordenadas.latitud));
        const maxLat = Math.max(...this.mundo.paises.map(p => p.coordenadas.latitud));
        const minLng = Math.min(...this.mundo.paises.map(p => p.coordenadas.longitud));
        const maxLng = Math.max(...this.mundo.paises.map(p => p.coordenadas.longitud));
        
        const escalaX = canvas.width / (maxLng - minLng);
        const escalaY = canvas.height / (maxLat - minLat);
        
        // Convertir coordenadas de clic a coordenadas geográficas aproximadas
        const lng = (x / escalaX) + minLng;
        const lat = maxLat - (y / escalaY);
        
        // Encontrar país más cercano al clic
        let paisCercano = null;
        let distanciaMinima = Infinity;
        
        this.mundo.paises.forEach(pais => {
            const distancia = Math.sqrt(
                Math.pow(pais.coordenadas.longitud - lng, 2) + 
                Math.pow(pais.coordenadas.latitud - lat, 2)
            );
            
            if (distancia < distanciaMinima) {
                distanciaMinima = distancia;
                paisCercano = pais;
            }
        });
        
        if (paisCercano && distanciaMinima < 0.1) { // Umbral de cercanía
            this.seleccionarPais(paisCercano.id);
        }
    }

    // ========== MÉTODOS DE MATRIZ ==========

    generarMatrizVisual() {
        const matrizContainer = document.getElementById('matrizContainer');
        
        if (this.mundo.paises.length === 0) {
            matrizContainer.innerHTML = '<div class="matriz-overlay"><p>Agrega países para ver la matriz</p></div>';
            return;
        }
        
        const matriz = this.mundo.obtenerMatrizVisualizacion();
        let html = '<table class="matriz-tabla">';
        
        matriz.forEach((fila, i) => {
            html += '<tr>';
            fila.forEach((celda, j) => {
                if (i === 0 && j === 0) {
                    html += `<th class="matriz-corner">${celda}</th>`;
                } else if (i === 0) {
                    const pais = this.mundo.paises[j-1];
                    html += `<th class="matriz-encabezado" title="${pais.nombre} (${Math.round(pais.estadoPoblacion.total / 1000000)}M)">${celda}</th>`;
                } else if (j === 0) {
                    const pais = this.mundo.paises[i-1];
                    html += `<th class="matriz-encabezado" title="${pais.nombre} (${Math.round(pais.estadoPoblacion.total / 1000000)}M)">${celda}</th>`;
                } else {
                    // Determinar si hay ruta
                    const tieneRuta = this.mundo.matrizAdyacencia[i-1][j-1] === 1;
                    const claseBase = tieneRuta ? 'matriz-celda-activa' : 'matriz-celda-inactiva';
                    const valor = tieneRuta ? '1' : '0';
                    
                    html += `<td class="matriz-celda ${claseBase}" 
                            data-fila="${i-1}" 
                            data-columna="${j-1}"
                            id="celda-${i-1}-${j-1}">${valor}</td>`;
                }
            });
            html += '</tr>';
        });
        
        html += '</table>';
        matrizContainer.innerHTML = html;
        
        // Agregar tooltips con información del tipo de ruta
        this.agregarTooltipsMatriz();
        
        // Agregar eventos
        this.agregarEventosMatriz();
    }

    agregarTooltipsMatriz() {
        // Primero, limpiar todas las clases de tipo
        document.querySelectorAll('.matriz-celda').forEach(celda => {
            celda.classList.remove('celda-aerea', 'celda-terrestre', 'celda-maritima');
            
            // Restaurar color gris para celdas inactivas
            if (celda.classList.contains('matriz-celda-inactiva')) {
                celda.style.backgroundColor = 'rgba(240, 240, 240, 0.5)';
                celda.style.color = '#888888';
            }
        });
        
        // Para cada ruta, asignar color según tipo
        this.mundo.tablaRutas.forEach((ruta, clave) => {
            const [idOrigen, idDestino] = clave.split('-').map(Number);
            
            // Encontrar la celda en el triángulo superior
            const fila = Math.min(idOrigen, idDestino);
            const columna = Math.max(idOrigen, idDestino);
            
            const celda = document.querySelector(
                `.matriz-celda[data-fila="${fila}"][data-columna="${columna}"]`
            );
            
            if (celda) {
                const paisOrigen = this.mundo.obtenerPaisPorId(idOrigen);
                const paisDestino = this.mundo.obtenerPaisPorId(idDestino);
                
                if (paisOrigen && paisDestino) {
                    const probabilidad = (ruta.calcularProbabilidadBase() * 100).toFixed(1);
                    const trafico = (ruta.trafico * 100).toFixed(0);
                    
                    // Tooltip informativo
                    celda.title = `${paisOrigen.nombre} ↔ ${paisDestino.nombre}\n` +
                                `Tipo: ${ruta.tipo}\n` +
                                `Distancia: ${Math.round(ruta.distancia)} km\n` +
                                `Tráfico: ${trafico}%\n` +
                                `Prob. contagio: ${probabilidad}%`;
                    
                    // Asignar clase CSS según tipo de ruta
                    switch(ruta.tipo) {
                        case 'AEREO':
                            celda.classList.add('celda-aerea');
                            break;
                        case 'TERRESTRE':
                            celda.classList.add('celda-terrestre');
                            break;
                        case 'MARITIMO':
                            celda.classList.add('celda-maritima');
                            break;
                    }
                    
                    // También establecer estilo directo como backup
                    const coloresDirectos = {
                        'AEREO': 'rgba(255, 100, 100, 0.7)',
                        'TERRESTRE': 'rgba(100, 255, 100, 0.7)',
                        'MARITIMO': 'rgba(100, 100, 255, 0.7)'
                    };
                    
                    celda.style.backgroundColor = coloresDirectos[ruta.tipo] || 'rgba(200, 200, 200, 0.7)';
                    celda.style.color = '#000000';
                    celda.style.fontWeight = 'bold';
                    
                    // Cambiar a clase activa si no lo está
                    celda.classList.remove('matriz-celda-inactiva');
                    celda.classList.add('matriz-celda-activa');
                    celda.textContent = '1';
                }
            }
        });
    }

    agregarEventosMatriz() {
        document.querySelectorAll('.matriz-celda').forEach(celda => {
            celda.addEventListener('click', (e) => {
                const fila = parseInt(celda.dataset.fila);
                const columna = parseInt(celda.dataset.columna);
                
                if (fila === columna) return; // No rutas a sí mismo
                
                // Solo permitir modificar en el triángulo superior
                if (columna <= fila) {
                    this.mostrarMensaje('Modifica solo la diagonal superior (matriz simétrica)', true);
                    return;
                }
                
                this.manejarClicCeldaMatriz(fila, columna, celda);
            });
        });
    }

    manejarClicCeldaMatriz(fila, columna, celda) {
        const paisOrigen = this.mundo.paises[fila];
        const paisDestino = this.mundo.paises[columna];
        
        // Verificar si ya existe una ruta
        const clave = `${Math.min(fila, columna)}-${Math.max(fila, columna)}`;
        const rutaExistente = this.mundo.tablaRutas.get(clave);
        
        // Guardar información de la ruta que estamos editando
        this.rutaEditando = {
            fila,
            columna,
            paisOrigenId: paisOrigen.id,
            paisDestinoId: paisDestino.id,
            tipoActual: rutaExistente ? rutaExistente.tipo : null,
            celda: celda
        };
        
        // Mostrar modal para seleccionar tipo de ruta
        this.mostrarModalTipoRuta(paisOrigen.nombre, paisDestino.nombre, rutaExistente);
    }

    mostrarModalTipoRuta(nombreOrigen, nombreDestino, rutaExistente) {
        document.getElementById('rutaPaises').textContent = 
            `${nombreOrigen} ↔ ${nombreDestino}`;
        
        // Mostrar u ocultar botón de eliminar
        const btnEliminar = document.getElementById('btnEliminarRuta');
        if (rutaExistente) {
            btnEliminar.style.display = 'inline-block';
            btnEliminar.textContent = `Eliminar Ruta ${rutaExistente.tipo}`;
            
            // Preseleccionar el tipo actual
            document.querySelectorAll('.tipo-ruta-opcion').forEach(opcion => {
                opcion.classList.remove('seleccionada');
                if (opcion.dataset.tipo === rutaExistente.tipo) {
                    opcion.classList.add('seleccionada');
                    this.tipoRutaSeleccionado = rutaExistente.tipo;
                }
            });
        } else {
            btnEliminar.style.display = 'none';
            // Deseleccionar todos
            document.querySelectorAll('.tipo-ruta-opcion').forEach(opcion => {
                opcion.classList.remove('seleccionada');
            });
            this.tipoRutaSeleccionado = null;
        }
        
        document.getElementById('modalTipoRuta').style.display = 'flex';
    }

    cerrarModalTipoRuta() {
        document.getElementById('modalTipoRuta').style.display = 'none';
        this.rutaEditando = null;
        this.tipoRutaSeleccionado = null;
    }

    confirmarTipoRuta() {
        if (!this.rutaEditando || !this.tipoRutaSeleccionado) {
            this.mostrarMensaje('Selecciona un tipo de ruta primero', true);
            return;
        }
        
        const { fila, columna, paisOrigenId, paisDestinoId, celda } = this.rutaEditando;
        const paisOrigen = this.mundo.paises[fila];
        const paisDestino = this.mundo.paises[columna];
        
        // Verificar si ya existe una ruta
        const clave = `${Math.min(fila, columna)}-${Math.max(fila, columna)}`;
        const rutaExistente = this.mundo.tablaRutas.get(clave);
        
        if (rutaExistente) {
            // Actualizar ruta existente
            rutaExistente.tipo = this.tipoRutaSeleccionado;
            rutaExistente.trafico = this.calcularTraficoSegunTipo(this.tipoRutaSeleccionado);
        } else {
            // Crear nueva ruta
            const trafico = this.calcularTraficoSegunTipo(this.tipoRutaSeleccionado);
            this.mundo.agregarRuta(paisOrigenId, paisDestinoId, this.tipoRutaSeleccionado, trafico);
        }
        
        // Actualizar tooltip
        const probabilidad = rutaExistente ? 
            (rutaExistente.calcularProbabilidadBase() * 100).toFixed(1) : '0.0';
        
        celda.title = `${paisOrigen.nombre} ↔ ${paisDestino.nombre}\n` +
                    `Tipo: ${this.tipoRutaSeleccionado}\n` +
                    `Prob. contagio: ${probabilidad}%`;
        
        // Actualizar clases CSS para el color
        celda.classList.remove('celda-aerea', 'celda-terrestre', 'celda-maritima');
        
        switch(this.tipoRutaSeleccionado) {
            case 'AEREO':
                celda.classList.add('celda-aerea');
                celda.style.backgroundColor = 'rgba(255, 100, 100, 0.7)';
                break;
            case 'TERRESTRE':
                celda.classList.add('celda-terrestre');
                celda.style.backgroundColor = 'rgba(100, 255, 100, 0.7)';
                break;
            case 'MARITIMO':
                celda.classList.add('celda-maritima');
                celda.style.backgroundColor = 'rgba(100, 100, 255, 0.7)';
                break;
        }
        
        celda.classList.remove('matriz-celda-inactiva');
        celda.classList.add('matriz-celda-activa');
        celda.textContent = '1';
        celda.style.color = '#000000';
        celda.style.fontWeight = 'bold';
        
        this.dibujarMapa();
        this.mostrarMensaje(`Ruta ${rutaExistente ? 'actualizada' : 'creada'}: ${paisOrigen.nombre} ↔ ${paisDestino.nombre} (${this.tipoRutaSeleccionado})`);
        this.cerrarModalTipoRuta();
    }

    eliminarRutaDesdeModal() {
        if (!this.rutaEditando) return;
        
        const { fila, columna, paisOrigenId, paisDestinoId, celda } = this.rutaEditando;
        const paisOrigen = this.mundo.paises[fila];
        const paisDestino = this.mundo.paises[columna];
        
        // Eliminar ruta (se elimina simétricamente)
        this.mundo.eliminarRuta(paisOrigenId, paisDestinoId);
        
        // Actualizar celda en la matriz
        celda.classList.remove('matriz-celda-activa');
        celda.classList.add('matriz-celda-inactiva');
        celda.textContent = '0';
        celda.title = 'Sin ruta';
        
        this.dibujarMapa();
        this.mostrarMensaje(`Ruta eliminada: ${paisOrigen.nombre} ↔ ${paisDestino.nombre}`);
        this.cerrarModalTipoRuta();
    }

    calcularTraficoSegunTipo(tipo) {
        // Valores de tráfico base según tipo
        const traficosBase = {
            'AEREO': 0.8,    // Alto tráfico
            'TERRESTRE': 0.6, // Medio tráfico
            'MARITIMO': 0.4   // Bajo tráfico
        };
        
        // Añadir variabilidad aleatoria
        const variacion = (Math.random() * 0.4) - 0.2; // ±20%
        return Math.min(Math.max(traficosBase[tipo] + variacion, 0.1), 0.95);
    }

    activarEdicionMatriz() {
        const btn = document.getElementById('btnEditarMatriz');
        const celdas = document.querySelectorAll('.matriz-celda');
        
        if (btn.innerHTML.includes('fa-edit')) {
            // Activar edición
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            celdas.forEach(celda => {
                celda.style.cursor = 'pointer';
                celda.style.backgroundColor = celda.classList.contains('matriz-celda-activa') ? 
                    'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.1)';
            });
        } else {
            // Guardar cambios
            btn.innerHTML = '<i class="fas fa-edit"></i> Modo Edición';
            celdas.forEach(celda => {
                celda.style.cursor = 'default';
                celda.style.backgroundColor = '';
            });
            
            this.mostrarMensaje('Cambios en la matriz guardados');
        }
    }

    // ========== MÉTODOS DE ANÁLISIS ==========

    predecir30Dias() {
        if (!this.simulacion) return;
        
        // Crear una copia profunda para predicción
        const mundoCopia = new Mundo();
        
        // Copiar países
        this.mundo.paises.forEach(paisOriginal => {
            const paisCopia = mundoCopia.agregarPais(
                paisOriginal.nombre,
                paisOriginal.estadoPoblacion.total / 1000000,
                paisOriginal.coordenadas.latitud,
                paisOriginal.coordenadas.longitud
            );
            
            // Copiar estado actual
            paisCopia.estadoPoblacion = { ...paisOriginal.estadoPoblacion };
            paisCopia.medidasVigentes = [...paisOriginal.medidasVigentes];
            paisCopia.estadoInfeccioso = paisOriginal.estadoInfeccioso;
            paisCopia.factorTransmision = paisOriginal.factorTransmision;
        });
        
        // Copiar rutas
        this.mundo.rutas.forEach(rutaOriginal => {
            mundoCopia.agregarRuta(
                rutaOriginal.idOrigen,
                rutaOriginal.idDestino,
                rutaOriginal.tipo,
                rutaOriginal.trafico
            );
        });
        
        // Crear copia de enfermedad
        const enfermedadCopia = new Enfermedad(
            this.enfermedad.nombre,
            this.enfermedad.tasaContagio * 100,
            this.enfermedad.tasaMortalidad * 100,
            this.enfermedad.tiempoRecuperacion,
            this.enfermedad.paisOrigen
        );
        enfermedadCopia.viaPrevaleciente = [...this.enfermedad.viaPrevaleciente];
        
        // Crear simulación para predicción
        const simPrediccion = new Simulacion(mundoCopia, enfermedadCopia);
        
        // Avanzar 30 días
        for (let i = 0; i < 30; i++) {
            simPrediccion.avanzarUnDia();
        }
        
        // Obtener resultados
        const stats = simPrediccion.obtenerEstadisticasGlobales();
        const paisesMasAfectados = simPrediccion.mundo.paises
            .filter(p => p.estadoPoblacion.infectada > 0)
            .sort((a, b) => b.estadoPoblacion.infectada - a.estadoPoblacion.infectada)
            .slice(0, 5);
        
        // Mostrar resultados
        let resultadoHTML = `<h4>Predicción para Día ${this.simulacion.fechaActual + 30}:</h4>`;
        resultadoHTML += `<p><strong>Total Infectados:</strong> ${stats.totalInfectados.toLocaleString()}</p>`;
        resultadoHTML += `<p><strong>Total Fallecidos:</strong> ${stats.totalFallecidos.toLocaleString()}</p>`;
        resultadoHTML += `<p><strong>Países Afectados:</strong> ${stats.paisesAfectados}</p>`;
        resultadoHTML += `<p><strong>Tasa Propagación Promedio:</strong> ${(stats.tasaPropagacion * 100).toFixed(2)}%</p>`;
        
        resultadoHTML += `<h4>Países más afectados:</h4><ul>`;
        paisesMasAfectados.forEach(pais => {
            const porcentaje = (pais.estadoPoblacion.infectada / pais.estadoPoblacion.total) * 100;
            resultadoHTML += `<li>${pais.nombre}: ${pais.estadoPoblacion.infectada.toLocaleString()} infectados (${porcentaje.toFixed(1)}%)</li>`;
        });
        resultadoHTML += `</ul>`;
        
        document.getElementById('resultadosAnalisis').innerHTML = resultadoHTML;
        
        // Dibujar en mapa de análisis con colores de predicción
        this.dibujarMapaAnalisis(simPrediccion);
        
        this.mostrarMensaje('Predicción de 30 días generada y mostrada en mapa de análisis');
    }

    dibujarMapaAnalisis(simulacionAnalisis, tipo = 'prediccion') {
        const canvas = document.getElementById('mapaAnalisisCanvas');
        const ctx = canvas.getContext('2d');
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Escalar coordenadas (usar mismo método que mapa principal)
        const minLat = Math.min(...simulacionAnalisis.mundo.paises.map(p => p.coordenadas.latitud));
        const maxLat = Math.max(...simulacionAnalisis.mundo.paises.map(p => p.coordenadas.latitud));
        const minLng = Math.min(...simulacionAnalisis.mundo.paises.map(p => p.coordenadas.longitud));
        const maxLng = Math.max(...simulacionAnalisis.mundo.paises.map(p => p.coordenadas.longitud));
        
        const margen = 0.15;
        const rangoLat = maxLat - minLat;
        const rangoLng = maxLng - minLng;
        
        const minLatConMargen = minLat - (rangoLat * margen);
        const maxLatConMargen = maxLat + (rangoLat * margen);
        const minLngConMargen = minLng - (rangoLng * margen);
        const maxLngConMargen = maxLng + (rangoLng * margen);
        
        const escalaX = canvas.width / (maxLngConMargen - minLngConMargen);
        const escalaY = canvas.height / (maxLatConMargen - minLatConMargen);
        
        // Dibujar según tipo de análisis
        if (tipo === 'prediccion') {
            // Dibujar países con colores según nivel de infección predicho
            simulacionAnalisis.mundo.paises.forEach(pais => {
                const x = (pais.coordenadas.longitud - minLngConMargen) * escalaX;
                const y = canvas.height - ((pais.coordenadas.latitud - minLatConMargen) * escalaY);
                
                const radio = Math.max(6, 4 + Math.log10(pais.estadoPoblacion.total / 1000000) * 2.5);
                
                // Color basado en porcentaje de infección
                const porcentajeInfectado = (pais.estadoPoblacion.infectada / pais.estadoPoblacion.total) * 100;
                
                let color;
                if (porcentajeInfectado === 0) {
                    color = '#4CAF50'; // Verde: libre
                } else if (porcentajeInfectado < 10) {
                    color = '#FFC107'; // Amarillo: bajo
                } else if (porcentajeInfectado < 30) {
                    color = '#FF9800'; // Naranja: medio
                } else {
                    color = '#F44336'; // Rojo: alto
                }
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, radio, 0, Math.PI * 2);
                ctx.fill();
                
                // Mostrar porcentaje
                if (porcentajeInfectado > 0) {
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${porcentajeInfectado.toFixed(0)}%`, x, y);
                }
            });
            
            document.getElementById('infoAnalisis').innerHTML = 
                '<p>Mapa de predicción a 30 días. Colores indican porcentaje de población infectada.</p>';
        }
    }

    identificarPaisesRiesgo() {
        const paisesLibres = this.mundo.paises.filter(p => p.estadoPoblacion.infectada === 0);
        const paisesInfectados = this.mundo.paises.filter(p => p.estadoPoblacion.infectada > 0);
        
        let paisesRiesgo = [];
        
        paisesLibres.forEach(paisLibre => {
            // Encontrar rutas desde países infectados a este país
            let riesgo = 0;
            
            paisesInfectados.forEach(paisInfectado => {
                const ruta = this.mundo.tablaRutas.get(`${paisInfectado.id}-${paisLibre.id}`);
                if (ruta && ruta.activa) {
                    riesgo += ruta.calcularProbabilidadBase() * 
                             (paisInfectado.estadoPoblacion.infectada / paisInfectado.estadoPoblacion.total);
                }
            });
            
            if (riesgo > 0.1) { // Umbral de riesgo
                paisesRiesgo.push({
                    pais: paisLibre,
                    riesgo: riesgo
                });
            }
        });
        
        paisesRiesgo.sort((a, b) => b.riesgo - a.riesgo);
        
        let resultadoHTML = `<h4>Países en Riesgo de Contagio:</h4>`;
        
        if (paisesRiesgo.length === 0) {
            resultadoHTML += `<p>No se identificaron países en riesgo alto.</p>`;
        } else {
            resultadoHTML += `<ul>`;
            paisesRiesgo.slice(0, 5).forEach(item => {
                resultadoHTML += `<li>${item.pais.nombre}: Riesgo ${(item.riesgo * 100).toFixed(1)}%</li>`;
            });
            resultadoHTML += `</ul>`;
        }
        
        document.getElementById('resultadosAnalisis').innerHTML = resultadoHTML;
        this.dibujarPaisesRiesgoEnMapa(paisesRiesgo);
    
        this.mostrarMensaje(`${paisesRiesgo.length} países identificados en riesgo`);
    }

    dibujarPaisesRiesgoEnMapa(paisesRiesgo) {
        const canvas = document.getElementById('mapaAnalisisCanvas');
        const ctx = canvas.getContext('2d');
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // ... (código para escalar y dibujar) ...
        
        // Dibujar países en riesgo con color especial
        paisesRiesgo.forEach(item => {
            const pais = item.pais;
            const x = (pais.coordenadas.longitud - minLngConMargen) * escalaX;
            const y = canvas.height - ((pais.coordenadas.latitud - minLatConMargen) * escalaY);
            
            const radio = Math.max(8, 6 + Math.log10(pais.estadoPoblacion.total / 1000000) * 2.5);
            
            // Color gradiente según riesgo
            const intensidad = Math.min(255, Math.floor(item.riesgo * 255 * 3));
            ctx.fillStyle = `rgb(255, ${255 - intensidad}, 0)`;
            
            ctx.beginPath();
            ctx.arc(x, y, radio, 0, Math.PI * 2);
            ctx.fill();
            
            // Borde
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Mostrar porcentaje de riesgo
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${(item.riesgo * 100).toFixed(0)}%`, x, y);
        });
        
        document.getElementById('infoAnalisis').innerHTML = 
            `<p>Países en riesgo identificados. Color indica nivel de riesgo.</p>`;
    }

    identificarRutasCriticas() {
        // Calcular centralidad de grado para cada ruta
        const rutasConImportancia = [];
        
        this.mundo.rutas.forEach(ruta => {
            const paisOrigen = this.mundo.obtenerPaisPorId(ruta.idOrigen);
            const paisDestino = this.mundo.obtenerPaisPorId(ruta.idDestino);
            
            if (!paisOrigen || !paisDestino) return;
            
            // Importancia basada en tráfico, probabilidad y estado de los países
            let importancia = ruta.trafico;
            importancia *= ruta.calcularProbabilidadBase();
            
            if (paisOrigen.estadoPoblacion.infectada > 0) {
                importancia *= 1 + (paisOrigen.estadoPoblacion.infectada / paisOrigen.estadoPoblacion.total);
            }
            
            rutasConImportancia.push({
                ruta: ruta,
                importancia: importancia,
                descripcion: `${paisOrigen.nombre} → ${paisDestino.nombre} (${ruta.tipo})`
            });
        });
        
        rutasConImportancia.sort((a, b) => b.importancia - a.importancia);
        
        let resultadoHTML = `<h4>Rutas de Expansión Críticas:</h4>`;
        
        if (rutasConImportancia.length === 0) {
            resultadoHTML += `<p>No hay rutas activas.</p>`;
        } else {
            resultadoHTML += `<ol>`;
            rutasConImportancia.slice(0, 5).forEach(item => {
                const porcentaje = (item.importancia * 100).toFixed(1);
                resultadoHTML += `<li>${item.descripcion}: Importancia ${porcentaje}%</li>`;
            });
            resultadoHTML += `</ol>`;
        }
        
        document.getElementById('resultadosAnalisis').innerHTML = resultadoHTML;
        this.mostrarMensaje('Rutas críticas identificadas');
    }

    filtrarRutasAereas() {
        // Dibujar solo rutas aéreas en el mapa de análisis
        const canvas = document.getElementById('mapaAnalisisCanvas');
        const ctx = canvas.getContext('2d');
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Escalar coordenadas
        const minLat = Math.min(...this.mundo.paises.map(p => p.coordenadas.latitud));
        const maxLat = Math.max(...this.mundo.paises.map(p => p.coordenadas.latitud));
        const minLng = Math.min(...this.mundo.paises.map(p => p.coordenadas.longitud));
        const maxLng = Math.max(...this.mundo.paises.map(p => p.coordenadas.longitud));
        
        const margen = 0.15;
        const rangoLat = maxLat - minLat;
        const rangoLng = maxLng - minLng;
        
        const minLatConMargen = minLat - (rangoLat * margen);
        const maxLatConMargen = maxLat + (rangoLat * margen);
        const minLngConMargen = minLng - (rangoLng * margen);
        const maxLngConMargen = maxLng + (rangoLng * margen);
        
        const escalaX = canvas.width / (maxLngConMargen - minLngConMargen);
        const escalaY = canvas.height / (maxLatConMargen - minLatConMargen);
        
        // Filtrar solo rutas aéreas
        const rutasAereas = this.mundo.rutas.filter(r => r.tipo === 'AEREO' && r.activa);
        
        // Dibujar rutas aéreas
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        
        rutasAereas.forEach(ruta => {
            const origen = this.mundo.obtenerPaisPorId(ruta.idOrigen);
            const destino = this.mundo.obtenerPaisPorId(ruta.idDestino);
            
            if (origen && destino) {
                const x1 = (origen.coordenadas.longitud - minLngConMargen) * escalaX;
                const y1 = canvas.height - ((origen.coordenadas.latitud - minLatConMargen) * escalaY);
                const x2 = (destino.coordenadas.longitud - minLngConMargen) * escalaX;
                const y2 = canvas.height - ((destino.coordenadas.latitud - minLatConMargen) * escalaY);
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
        
        // Dibujar países
        this.mundo.paises.forEach(pais => {
            const x = (pais.coordenadas.longitud - minLngConMargen) * escalaX;
            const y = canvas.height - ((pais.coordenadas.latitud - minLatConMargen) * escalaY);
            
            const radio = Math.max(6, 4 + Math.log10(pais.estadoPoblacion.total / 1000000) * 2.5);
            
            ctx.fillStyle = pais.getColorEstado();
            ctx.beginPath();
            ctx.arc(x, y, radio, 0, Math.PI * 2);
            ctx.fill();
            
            // Nombre solo si hay ruta aérea
            const tieneRutaAerea = rutasAereas.some(r => 
                r.idOrigen === pais.id || r.idDestino === pais.id
            );
            
            if (tieneRutaAerea) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(pais.nombre.substring(0, 8), x, y - radio - 5);
            }
        });
        
        document.getElementById('resultadosAnalisis').innerHTML = 
            `<h4>Filtro Aplicado</h4><p>Mostrando ${rutasAereas.length} rutas aéreas activas.</p>`;
        
        document.getElementById('infoAnalisis').innerHTML = 
            `<p>Mapa filtrado: solo rutas aéreas. ${rutasAereas.length} conexiones activas.</p>`;
        
        this.mostrarMensaje('Filtro de rutas aéreas aplicado en mapa de análisis');
    }

    // ========== UTILIDADES ==========

    mostrarMensaje(mensaje, esError = false) {
        console.log(esError ? '❌ ' + mensaje : '✅ ' + mensaje);
        
        // Podrías agregar aquí un sistema de notificaciones en la UI
        const estado = document.getElementById('estadoSimulacion');
        const estadoOriginal = estado.textContent;
        
        estado.textContent = esError ? `Error: ${mensaje}` : `Info: ${mensaje}`;
        estado.style.color = esError ? '#e74c3c' : '#27ae60';
        
        setTimeout(() => {
            estado.textContent = estadoOriginal;
            estado.style.color = '';
        }, 3000);
    }
}

// ================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ================================

let controlador;

document.addEventListener('DOMContentLoaded', () => {
    controlador = new ControladorAplicacion();
    
    // Añadir estilos adicionales para la matriz
    const style = document.createElement('style');
    style.textContent = `
        .matriz-tabla {
            border-collapse: collapse;
            width: 100%;
            font-size: 0.8rem;
        }
        
        .matriz-tabla th, .matriz-tabla td {
            border: 1px solid #ddd;
            padding: 4px;
            text-align: center;
            min-width: 30px;
            height: 30px;
        }
        
        .matriz-corner {
            background-color: #2c3e50;
            color: white;
            font-weight: bold;
        }
        
        .matriz-encabezado {
            background-color: #34495e;
            color: white;
            font-weight: bold;
            cursor: help;
        }
        
        .matriz-celda-activa {
            background-color: rgba(76, 175, 80, 0.7);
            color: white;
            font-weight: bold;
            cursor: pointer;
        }
        
        .matriz-celda-inactiva {
            background-color: rgba(244, 67, 54, 0.2);
            color: #666;
            cursor: pointer;
        }
        
        .matriz-celda-activa:hover {
            background-color: rgba(76, 175, 80, 0.9);
        }
        
        .matriz-celda-inactiva:hover {
            background-color: rgba(244, 67, 54, 0.4);
        }
        
        .modal-stats {
            margin: 15px 0;
        }
        
        .modal-stat {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        
        .modal-label {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .modal-value {
            font-weight: bold;
        }
        
        .modal-section {
            margin: 15px 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .modal-section h4 {
            margin-bottom: 10px;
            color: #2c3e50;
        }
        
        .modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
    `;
    document.head.appendChild(style);
});