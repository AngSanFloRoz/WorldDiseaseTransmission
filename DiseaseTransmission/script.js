// ================================
// CLASES DEL MODELO DE DATOS - VERSIÓN MEJORADA
// ================================

class Region {
    constructor(id, nombre, poblacionTotal, latitud, longitud) {
        this.id = id;
        this.nombre = nombre;
        this.coordenadas = { latitud, longitud };
        
        // Sistema de cohortes para manejar reinfecciones
        this.cohortesInfectados = [];
        this.cohortesRecuperados = [];
        
        this.estadoPoblacion = {
            total: poblacionTotal * 1000000,
            susceptible: poblacionTotal * 1000000,
            infectada: 0,
            recuperada: 0,
            fallecida: 0,
            reinfectados: 0
        };
        
        this.medidasVigentes = [];
        this.estadoInfeccioso = 'LIBRE';
        this.factorTransmision = 1.0;
        this.enCuarentena = false;
        this.rutasCortadas = [];
        this.historialEstados = [];
    }

    agregarInfeccion(cantidad, dia, esReinfeccion = false) {
        if (cantidad <= 0 || this.enCuarentena) return;
        
        cantidad = Math.min(cantidad, this.estadoPoblacion.susceptible);
        
        if (cantidad > 0) {
            this.estadoPoblacion.susceptible -= cantidad;
            this.estadoPoblacion.infectada += cantidad;
            
            this.cohortesInfectados.push({
                diaInicio: dia,
                cantidad: cantidad,
                esReinfeccion: esReinfeccion,
                vecesInfectado: esReinfeccion ? 2 : 1
            });
            
            if (esReinfeccion) {
                this.estadoPoblacion.reinfectados += cantidad;
            }
            
            this.actualizarEstadoInfeccioso();
            this.registrarHistorial();
        }
    }

    actualizarEstado(nuevosValores) {
        Object.keys(nuevosValores).forEach(key => {
            if (nuevosValores[key] < 0) nuevosValores[key] = 0;
            this.estadoPoblacion[key] = nuevosValores[key];
        });
        
        const suma = this.estadoPoblacion.susceptible + 
                    this.estadoPoblacion.infectada + 
                    this.estadoPoblacion.recuperada + 
                    this.estadoPoblacion.fallecida;
        
        if (suma > this.estadoPoblacion.total) {
            const factor = this.estadoPoblacion.total / suma;
            this.estadoPoblacion.susceptible = Math.round(this.estadoPoblacion.susceptible * factor);
            this.estadoPoblacion.infectada = Math.round(this.estadoPoblacion.infectada * factor);
            this.estadoPoblacion.recuperada = Math.round(this.estadoPoblacion.recuperada * factor);
            this.estadoPoblacion.fallecida = Math.round(this.estadoPoblacion.fallecida * factor);
            
            const ajuste = this.estadoPoblacion.total - 
                         (this.estadoPoblacion.susceptible + 
                          this.estadoPoblacion.infectada + 
                          this.estadoPoblacion.recuperada + 
                          this.estadoPoblacion.fallecida);
            
            if (ajuste !== 0) {
                this.estadoPoblacion.susceptible += ajuste;
            }
        }
        
        this.actualizarEstadoInfeccioso();
        this.registrarHistorial();
    }

    actualizarEstadoInfeccioso() {
        const porcentajeInfectado = (this.estadoPoblacion.infectada / this.estadoPoblacion.total) * 100;
        
        if (this.estadoPoblacion.infectada === 0) {
            if (this.estadoPoblacion.recuperada > 0) {
                this.estadoInfeccioso = 'RECUPERADO';
            } else {
                this.estadoInfeccioso = 'LIBRE';
            }
        } else if (porcentajeInfectado < 1) {
            this.estadoInfeccioso = 'EXPUESTO';
        } else if (porcentajeInfectado < 10) {
            this.estadoInfeccioso = 'INFECTADO';
        } else if (porcentajeInfectado < 30) {
            this.estadoInfeccioso = 'BROTE';
        } else {
            this.estadoInfeccioso = 'EPIDEMIA';
        }
    }

    registrarHistorial() {
        this.historialEstados.push({
            fecha: new Date().toISOString(),
            estado: this.estadoInfeccioso,
            datos: { ...this.estadoPoblacion },
            enCuarentena: this.enCuarentena
        });
        
        if (this.historialEstados.length > 100) {
            this.historialEstados.shift();
        }
    }

    procesarCohortes(diaActual, enfermedad) {
        let totalFallecidos = 0;
        let totalRecuperados = 0;
        let cohortesProcesadas = [];
        
        for (let i = this.cohortesInfectados.length - 1; i >= 0; i--) {
            const cohorte = this.cohortesInfectados[i];
            const diasTranscurridos = diaActual - cohorte.diaInicio;
            
            if (diasTranscurridos >= enfermedad.tiempoRecuperacion) {
                const fallecidos = Math.floor(cohorte.cantidad * enfermedad.tasaMortalidad);
                const recuperados = cohorte.cantidad - fallecidos;
                
                totalFallecidos += fallecidos;
                totalRecuperados += recuperados;
                
                this.cohortesRecuperados.push({
                    diaRecuperacion: diaActual,
                    cantidad: recuperados,
                    vecesInfectado: cohorte.vecesInfectado
                });
                
                cohortesProcesadas.push(i);
            }
        }
        
        cohortesProcesadas.forEach(index => {
            this.cohortesInfectados.splice(index, 1);
        });
        
        if (cohortesProcesadas.length > 0) {
            this.estadoPoblacion.infectada -= (totalFallecidos + totalRecuperados);
            this.estadoPoblacion.fallecida += totalFallecidos;
            this.estadoPoblacion.recuperada += totalRecuperados;
            
            if (!this.enCuarentena) {
                this.aplicarPerdidaInmunidad(enfermedad);
            }
            
            this.actualizarEstadoInfeccioso();
            this.registrarHistorial();
        }
    }

    aplicarPerdidaInmunidad(enfermedad) {
        if (this.estadoPoblacion.recuperada === 0 || this.enCuarentena) return;
        
        const tasaBasePerdida = 0.001;
        const perdida = Math.max(1, Math.floor(this.estadoPoblacion.recuperada * tasaBasePerdida));
        
        if (perdida > 0) {
            this.estadoPoblacion.recuperada -= perdida;
            this.estadoPoblacion.susceptible += perdida;
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

    toggleCuarentena(activo) {
        const anterior = this.enCuarentena;
        this.enCuarentena = activo;
        
        if (activo && !this.medidasVigentes.includes('cuarentena')) {
            this.medidasVigentes.push('cuarentena');
        } else if (!activo) {
            const index = this.medidasVigentes.indexOf('cuarentena');
            if (index > -1) {
                this.medidasVigentes.splice(index, 1);
            }
        }
        
        this.calcularFactorTransmision();
        
        if (anterior !== activo) {
            this.registrarHistorial();
        }
    }

    calcularFactorTransmision() {
        let factor = 1.0;
        
        this.medidasVigentes.forEach(medida => {
            switch(medida) {
                case 'cuarentena': factor *= this.enCuarentena ? 0.0 : 0.3; break;
                case 'cierre_fronteras': factor *= 0.1; break;
                case 'distanciamiento': factor *= 0.6; break;
                case 'mascarillas': factor *= 0.8; break;
                case 'vacunacion': factor *= 0.7; break;
            }
        });
        
        this.factorTransmision = Math.max(factor, 0.0);
        return this.factorTransmision;
    }

    getColorEstado() {
        if (this.enCuarentena) return '#673AB7';
        
        const colores = {
            'LIBRE': '#4CAF50',
            'EXPUESTO': '#FFC107',
            'INFECTADO': '#F44336',
            'RECUPERADO': '#2196F3',
            'BROTE': '#E91E63',
            'EPIDEMIA': '#D32F2F'
        };
        return colores[this.estadoInfeccioso] || '#757575';
    }

    getIconoEstado() {
        const iconos = {
            'LIBRE': '🟢',
            'EXPUESTO': '🟡',
            'INFECTADO': '🔴',
            'RECUPERADO': '🔵',
            'BROTE': '🟣',
            'EPIDEMIA': '⚫'
        };
        return iconos[this.estadoInfeccioso] || '⚪';
    }
}

class RutaTransmision {
    constructor(idOrigen, idDestino, tipo, trafico = 0.5, distancia = 1000) {
        const [menorId, mayorId] = idOrigen < idDestino ? 
            [idOrigen, idDestino] : [idDestino, idOrigen];
        
        this.idOrigen = menorId;
        this.idDestino = mayorId;
        this.tipo = tipo;
        this.trafico = Math.min(Math.max(trafico, 0), 1);
        this.distancia = distancia;
        this.tiempoViajePromedio = this.calcularTiempoViaje();
        this.activa = true;
        this.cortada = false;
        this.historialTrafico = [];
    }

    calcularTiempoViaje() {
        const velocidadesBase = {
            'AEREO': 600,
            'TERRESTRE': 60,
            'MARITIMO': 30
        };
        
        const tiempoBase = this.distancia / (velocidadesBase[this.tipo] || 50);
        
        const tiemposProceso = {
            'AEREO': 6,
            'TERRESTRE': 2,
            'MARITIMO': 12
        };
        
        return tiempoBase + (tiemposProceso[this.tipo] || 0);
    }

    calcularProbabilidadBase(factorContagio = 1.0) {
        if (this.cortada) return 0;
        
        let probabilidad = this.trafico * 0.4 + 
                          (1 / (1 + this.distancia / 500)) * 0.3 +
                          (1 / (1 + this.tiempoViajePromedio / 24)) * 0.3;
        
        const factoresTipo = {
            'AEREO': 0.8,
            'TERRESTRE': 0.9,
            'MARITIMO': 0.6
        };
        
        probabilidad *= factoresTipo[this.tipo] || 0.5;
        probabilidad *= Math.exp(-this.tiempoViajePromedio / 48);
        probabilidad *= factorContagio;
        
        return Math.min(Math.max(probabilidad, 0.01), 0.95);
    }

    cortar() {
        this.cortada = true;
        this.historialTrafico.push({
            fecha: new Date().toISOString(),
            accion: 'CORTADA',
            traficoAnterior: this.trafico
        });
    }

    restaurar() {
        this.cortada = false;
        this.historialTrafico.push({
            fecha: new Date().toISOString(),
            accion: 'RESTAURADA'
        });
    }

    getColor() {
        if (this.cortada) return 'rgba(128, 128, 128, 0.3)';
        
        const colores = {
            'AEREO': 'rgba(255, 0, 0, 0.6)',
            'TERRESTRE': 'rgba(0, 128, 0, 0.6)',
            'MARITIMO': 'rgba(0, 0, 255, 0.6)'
        };
        return colores[this.tipo] || 'rgba(100, 100, 100, 0.6)';
    }

    getIconoTipo() {
        const iconos = {
            'AEREO': '✈️',
            'TERRESTRE': '🚗',
            'MARITIMO': '🚢'
        };
        return iconos[this.tipo] || '🛤️';
    }
}

class Enfermedad {
    constructor(nombre, tasaContagio, tasaMortalidad, tiempoRecuperacion, regionOrigen) {
        this.nombre = nombre;
        this.tasaContagio = tasaContagio / 100;
        this.tasaMortalidad = tasaMortalidad / 100;
        this.tiempoRecuperacion = tiempoRecuperacion;
        this.regionOrigen = regionOrigen;
        this.viaPrevaleciente = ['AEREO', 'TERRESTRE'];
        this.diasTranscurridos = 0;
        this.factorReduccionReinfeccion = 0.3;
        this.variantes = [];
        this.registrarVariante('Original', this.tasaContagio, this.tasaMortalidad);
    }

    evolucionar(dias = 1) {
        this.diasTranscurridos += dias;
        
        if (this.diasTranscurridos >= 30 && !this.viaPrevaleciente.includes('MARITIMO')) {
            this.viaPrevaleciente.push('MARITIMO');
        }
        
        if (this.diasTranscurridos >= 90) {
            const nuevaVariante = this.generarVariante();
            this.variantes.push(nuevaVariante);
            this.aplicarVariante(nuevaVariante);
        }
    }

    generarVariante() {
        const nombres = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omicron'];
        const nombre = nombres[Math.floor(Math.random() * nombres.length)];
        const incrementoContagio = 0.1 + Math.random() * 0.2;
        const cambioMortalidad = -0.05 + Math.random() * 0.1;
        
        return {
            nombre: nombre,
            tasaContagio: this.tasaContagio * (1 + incrementoContagio),
            tasaMortalidad: this.tasaMortalidad * (1 + cambioMortalidad),
            diaAparicion: this.diasTranscurridos,
            resistenciaInmunidad: 0.3 + Math.random() * 0.4
        };
    }

    aplicarVariante(variante) {
        this.tasaContagio = variante.tasaContagio;
        this.tasaMortalidad = variante.tasaMortalidad;
        this.factorReduccionReinfeccion = 1 - variante.resistenciaInmunidad;
    }

    registrarVariante(nombre, tasaContagio, tasaMortalidad) {
        this.variantes.push({
            nombre: nombre,
            tasaContagio: tasaContagio,
            tasaMortalidad: tasaMortalidad,
            diaAparicion: 0
        });
    }

    calcularProbabilidadInfeccion(vecesInfectado = 1, esReinfeccion = false) {
        let probabilidadBase = this.tasaContagio;
        
        if (esReinfeccion) {
            probabilidadBase *= this.factorReduccionReinfeccion * 
                              Math.pow(0.5, vecesInfectado - 2);
        }
        
        return Math.min(probabilidadBase, 0.99);
    }

    generarGrafoProbabilistico(mundo) {
        const grafo = { 
            nodos: [], 
            aristas: [],
            aristasReinfeccion: []
        };
        
        mundo.regiones.forEach(region => {
            grafo.nodos.push({
                id: region.id,
                nombre: region.nombre,
                estado: region.estadoInfeccioso,
                infectados: region.estadoPoblacion.infectada,
                recuperados: region.estadoPoblacion.recuperada,
                reinfectados: region.estadoPoblacion.reinfectados,
                factorTransmision: region.factorTransmision,
                enCuarentena: region.enCuarentena,
                susceptibleReinfeccion: Math.max(0, region.estadoPoblacion.recuperada * 0.1)
            });
        });
        
        mundo.rutas.forEach(ruta => {
            if (ruta.activa && !ruta.cortada) {
                const regionOrigen = mundo.obtenerRegionPorId(ruta.idOrigen);
                const regionDestino = mundo.obtenerRegionPorId(ruta.idDestino);
                
                if (!regionOrigen || !regionDestino) return;
                
                if (regionOrigen.enCuarentena || regionDestino.enCuarentena) return;
                
                let probabilidad = ruta.calcularProbabilidadBase(this.tasaContagio);
                
                if (this.viaPrevaleciente.includes(ruta.tipo)) {
                    probabilidad *= 1.5;
                }
                
                probabilidad *= regionDestino.factorTransmision;
                
                let probabilidadReinfeccion = probabilidad * this.factorReduccionReinfeccion;
                
                const proporcionRecuperados = regionDestino.estadoPoblacion.recuperada / 
                                            regionDestino.estadoPoblacion.total;
                probabilidadReinfeccion *= (1 - proporcionRecuperados * 0.7);
                
                grafo.aristas.push({
                    origen: ruta.idOrigen,
                    destino: ruta.idDestino,
                    tipo: ruta.tipo,
                    probabilidad: Math.min(probabilidad, 0.99),
                    distancia: ruta.distancia,
                    esReinfeccion: false
                });
                
                if (regionDestino.estadoPoblacion.recuperada > 0) {
                    grafo.aristasReinfeccion.push({
                        origen: ruta.idOrigen,
                        destino: ruta.idDestino,
                        tipo: ruta.tipo,
                        probabilidad: Math.min(probabilidadReinfeccion, 0.5),
                        distancia: ruta.distancia,
                        esReinfeccion: true,
                        factorReduccion: this.factorReduccionReinfeccion
                    });
                }
            }
        });
        
        return grafo;
    }
}

class Mundo {
    constructor(configMapa = 'mundo') {
        this.regiones = [];
        this.rutas = [];
        this.matrizAdyacencia = [];
        this.tablaRegiones = new Map();
        this.tablaRutas = new Map();
        this.idCounter = 0;
        this.configMapa = configMapa;
        
        this.cargarMapa(configMapa);
        this.crearRutasAleatorias();
        this.sincronizarEstructuras();
    }

    cargarMapa(tipoMapa) {
        this.regiones = [];
        this.tablaRegiones.clear();
        this.idCounter = 0;
        
        switch(tipoMapa) {
            case 'mundo':
                this.cargarMapaMundo();
                break;
            case 'america_latina':
                this.cargarMapaAmericaLatina();
                break;
            case 'colombia':
                this.cargarMapaColombia();
                break;
            default:
                this.cargarMapaMundo();
        }
        this.configMapa = tipoMapa;
    }

    cargarMapaMundo() {
        const regionesMundo = [
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
        
        regionesMundo.forEach(p => this.agregarRegionDirecto(p.nombre, p.poblacion, p.lat, p.lng));
    }

    cargarMapaAmericaLatina() {
        const regionesAL = [
            { nombre: "México", poblacion: 128.9, lat: 23.6345, lng: -102.5528 },
            { nombre: "Colombia", poblacion: 51.52, lat: 4.5709, lng: -74.2973 },
            { nombre: "Argentina", poblacion: 45.81, lat: -38.4161, lng: -63.6167 },
            { nombre: "Brasil", poblacion: 213.99, lat: -14.2350, lng: -51.9253 },
            { nombre: "Chile", poblacion: 19.12, lat: -35.6751, lng: -71.5429 },
            { nombre: "Perú", poblacion: 33.72, lat: -9.1900, lng: -75.0152 },
            { nombre: "Venezuela", poblacion: 28.44, lat: 6.4238, lng: -66.5897 },
            { nombre: "Ecuador", poblacion: 17.64, lat: -1.8312, lng: -78.1834 },
            { nombre: "Uruguay", poblacion: 3.47, lat: -32.5228, lng: -55.7658 },
            { nombre: "Paraguay", poblacion: 7.13, lat: -23.4425, lng: -58.4438 }
        ];
        
        regionesAL.forEach(p => this.agregarRegionDirecto(p.nombre, p.poblacion, p.lat, p.lng));
    }

    cargarMapaColombia() {
        const departamentos = [
            { nombre: "Bogotá D.C.", poblacion: 7.18, lat: 4.7110, lng: -74.0721 },
            { nombre: "Antioquia", poblacion: 6.41, lat: 6.5593, lng: -75.8281 },
            { nombre: "Valle del Cauca", poblacion: 4.47, lat: 3.8009, lng: -76.6413 },
            { nombre: "Cundinamarca", poblacion: 2.92, lat: 5.0264, lng: -74.0300 },
            { nombre: "Santander", poblacion: 2.18, lat: 6.6437, lng: -73.6536 },
            { nombre: "Atlántico", poblacion: 2.49, lat: 10.6966, lng: -74.8741 },
            { nombre: "Bolívar", poblacion: 2.07, lat: 8.6704, lng: -74.0300 },
            { nombre: "Nariño", poblacion: 1.63, lat: 1.2892, lng: -77.3579 },
            { nombre: "Córdoba", poblacion: 1.78, lat: 8.0493, lng: -75.5740 },
            { nombre: "Boyacá", poblacion: 1.22, lat: 5.4545, lng: -73.3620 }
        ];
        
        departamentos.forEach(d => this.agregarRegionDirecto(d.nombre, d.poblacion, d.lat, d.lng));
    }

    agregarRegionDirecto(nombre, poblacion, latitud, longitud) {
        const id = this.idCounter++;
        const region = new Region(id, nombre, poblacion, latitud, longitud);
        this.regiones.push(region);
        this.tablaRegiones.set(id, region);
        return region;
    }

    sincronizarEstructuras() {
        this.tablaRegiones.clear();
        this.regiones.forEach(region => this.tablaRegiones.set(region.id, region));
        
        const n = this.regiones.length;
        this.matrizAdyacencia = [];
        for (let i = 0; i < n; i++) this.matrizAdyacencia[i] = new Array(n).fill(0);
        
        this.tablaRutas.forEach((ruta, clave) => {
            const [idOrigen, idDestino] = clave.split('-').map(Number);
            const idxOrigen = this.regiones.findIndex(p => p.id === idOrigen);
            const idxDestino = this.regiones.findIndex(p => p.id === idDestino);
            
            if (idxOrigen !== -1 && idxDestino !== -1) {
                this.matrizAdyacencia[idxOrigen][idxDestino] = 1;
                this.matrizAdyacencia[idxDestino][idxOrigen] = 1;
            }
        });
        
        this.rutas = Array.from(this.tablaRutas.values());
    }

    obtenerRegionPorId(id) {
        return this.tablaRegiones.get(id);
    }

    obtenerRegionPorNombre(nombre) {
        return this.regiones.find(r => r.nombre === nombre);
    }

    agregarRuta(idOrigen, idDestino, tipo, trafico = 0.5) {
        const regionOrigen = this.obtenerRegionPorId(idOrigen);
        const regionDestino = this.obtenerRegionPorId(idDestino);
        
        if (!regionOrigen || !regionDestino || idOrigen === idDestino) return null;
        
        const [menorId, mayorId] = idOrigen < idDestino ? 
            [idOrigen, idDestino] : [idDestino, idOrigen];
        
        const distancia = this.calcularDistancia(
            regionOrigen.coordenadas.latitud, regionOrigen.coordenadas.longitud,
            regionDestino.coordenadas.latitud, regionDestino.coordenadas.longitud
        );
        
        const ruta = new RutaTransmision(menorId, mayorId, tipo, trafico, distancia);
        const clave = `${menorId}-${mayorId}`;
        this.tablaRutas.set(clave, ruta);
        this.sincronizarEstructuras();
        return ruta;
    }

    eliminarRuta(idOrigen, idDestino) {
        const [menorId, mayorId] = idOrigen < idDestino ? 
            [idOrigen, idDestino] : [idDestino, idOrigen];
        const clave = `${menorId}-${mayorId}`;
        
        if (this.tablaRutas.has(clave)) {
            this.tablaRutas.delete(clave);
            this.sincronizarEstructuras();
            return true;
        }
        return false;
    }

    cortarRutasRegion(regionId) {
        const region = this.obtenerRegionPorId(regionId);
        if (!region) return false;
        
        region.rutasCortadas = [];
        let rutasCortadas = 0;
        
        this.tablaRutas.forEach((ruta, clave) => {
            if ((ruta.idOrigen === regionId || ruta.idDestino === regionId) && ruta.activa && !ruta.cortada) {
                ruta.cortar();
                region.rutasCortadas.push(clave);
                rutasCortadas++;
            }
        });
        
        return rutasCortadas > 0;
    }

    restaurarRutasRegion(regionId) {
        const region = this.obtenerRegionPorId(regionId);
        if (!region) return false;
        
        let rutasRestauradas = 0;
        
        region.rutasCortadas.forEach(clave => {
            const ruta = this.tablaRutas.get(clave);
            if (ruta) {
                ruta.restaurar();
                rutasRestauradas++;
            }
        });
        
        region.rutasCortadas = [];
        return rutasRestauradas > 0;
    }

    obtenerRutasConectadas(regionId) {
        const rutasDesde = [];
        this.tablaRutas.forEach(ruta => {
            if ((ruta.idOrigen === regionId || ruta.idDestino === regionId) && ruta.activa) {
                const esOrigen = ruta.idOrigen === regionId;
                const otraRegionId = esOrigen ? ruta.idDestino : ruta.idOrigen;
                rutasDesde.push({
                    ...ruta, 
                    direccion: esOrigen ? 'salida' : 'entrada',
                    regionConectadaId: otraRegionId
                });
            }
        });
        return rutasDesde;
    }

    obtenerRutasActivasConectadas(regionId) {
        return this.obtenerRutasConectadas(regionId).filter(r => !r.cortada);
    }

    obtenerMatrizVisualizacion() {
        const matriz = [];
        const encabezado = ['Región', ...this.regiones.map(p => p.nombre.substring(0, 3))];
        matriz.push(encabezado);
        
        this.regiones.forEach((region, i) => {
            const fila = [region.nombre.substring(0, 10)];
            this.regiones.forEach((_, j) => {
                if (j >= i) {
                    const clave = `${Math.min(i, j)}-${Math.max(i, j)}`;
                    const ruta = this.tablaRutas.get(clave);
                    if (ruta) {
                        fila.push(ruta.cortada ? 'X' : '1');
                    } else {
                        fila.push(0);
                    }
                } else {
                    fila.push('·');
                }
            });
            matriz.push(fila);
        });
        
        return matriz;
    }

    calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371;
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
        const densidad = this.configMapa === 'colombia' ? 0.6 : 0.4;
        
        for (let i = 0; i < this.regiones.length; i++) {
            for (let j = i + 1; j < this.regiones.length; j++) {
                if (Math.random() < densidad) {
                    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
                    const trafico = 0.3 + Math.random() * 0.5;
                    this.agregarRuta(i, j, tipo, trafico);
                }
            }
        }
    }

    obtenerEstadisticasRutas() {
        let totalRutas = this.rutas.length;
        let rutasAereas = this.rutas.filter(r => r.tipo === 'AEREO').length;
        let rutasTerrestres = this.rutas.filter(r => r.tipo === 'TERRESTRE').length;
        let rutasMaritimas = this.rutas.filter(r => r.tipo === 'MARITIMO').length;
        let rutasCortadas = this.rutas.filter(r => r.cortada).length;
        
        return {
            totalRutas,
            rutasAereas,
            rutasTerrestres,
            rutasMaritimas,
            rutasCortadas,
            porcentajeCortadas: totalRutas > 0 ? (rutasCortadas / totalRutas * 100).toFixed(1) : 0
        };
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
            propagacionInterna: true,
            propagacionExterna: true,
            permitirReinfecciones: true,
            velocidadPropagacion: 1.0
        };
        this.historial = [];
        this.inicializar();
    }

    inicializar() {
        if (this.enfermedad.regionOrigen !== null) {
            const regionOrigen = this.mundo.obtenerRegionPorId(this.enfermedad.regionOrigen);
            if (regionOrigen) {
                const infectadosIniciales = Math.max(1000, regionOrigen.estadoPoblacion.total * 0.0001);
                regionOrigen.agregarInfeccion(infectadosIniciales, this.fechaActual, false);
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
        
        this.enfermedad.evolucionar(1);
        this.fechaActual++;
        this.regenerarGrafo();
        
        this.mundo.regiones.forEach(region => {
            region.procesarCohortes(this.fechaActual, this.enfermedad);
        });
        
        if (this.configuracion.propagacionInterna) {
            this.mundo.regiones.forEach(region => this.propagarInternamente(region));
        }
        
        if (this.configuracion.propagacionExterna) this.propagarEntreRegiones();
        this.guardarSnapshot();
    }

    propagarInternamente(region) {
        if (region.estadoPoblacion.infectada === 0 || region.estadoPoblacion.susceptible === 0 || region.enCuarentena) return;
        
        const tasaContactoBase = 10 * this.configuracion.velocidadPropagacion;
        const contactosTotales = tasaContactoBase * region.estadoPoblacion.total;
        const proporcionInfectados = region.estadoPoblacion.infectada / region.estadoPoblacion.total;
        const contactosInfectados = contactosTotales * proporcionInfectados;
        const factorMedidas = region.factorTransmision;
        
        const contactosEfectivos = contactosInfectados * factorMedidas;
        
        const proporcionSusceptibles = region.estadoPoblacion.susceptible / 
                                     (region.estadoPoblacion.total - region.estadoPoblacion.infectada);
        const contactosConSusceptibles = contactosEfectivos * proporcionSusceptibles;
        
        const probabilidadContagio = this.enfermedad.calcularProbabilidadInfeccion(1, false);
        
        let nuevosInfectados = Math.floor(
            contactosConSusceptibles * probabilidadContagio
        );
        
        nuevosInfectados = Math.max(nuevosInfectados, 0);
        nuevosInfectados = Math.min(
            nuevosInfectados,
            region.estadoPoblacion.susceptible,
            Math.ceil(region.estadoPoblacion.susceptible * 0.05)
        );
        
        if (nuevosInfectados > 0) {
            region.agregarInfeccion(nuevosInfectados, this.fechaActual, false);
        }
        
        if (this.configuracion.permitirReinfecciones && region.estadoPoblacion.recuperada > 0 && !region.enCuarentena) {
            this.propagarReinfeccionInterna(region);
        }
    }

    propagarReinfeccionInterna(region) {
        const tasaContactoRecuperados = 6 * this.configuracion.velocidadPropagacion;
        const contactosRecuperados = tasaContactoRecuperados * region.estadoPoblacion.recuperada;
        const proporcionInfectados = region.estadoPoblacion.infectada / region.estadoPoblacion.total;
        const contactosConInfectados = contactosRecuperados * proporcionInfectados;
        
        const probabilidadReinfeccion = this.enfermedad.calcularProbabilidadInfeccion(2, true);
        
        let posiblesReinfecciones = Math.floor(
            contactosConInfectados * probabilidadReinfeccion
        );
        
        posiblesReinfecciones = Math.min(
            posiblesReinfecciones,
            region.estadoPoblacion.recuperada,
            Math.ceil(region.estadoPoblacion.recuperada * 0.01)
        );
        
        if (posiblesReinfecciones > 0) {
            region.agregarInfeccion(posiblesReinfecciones, this.fechaActual, true);
        }
    }

    propagarEntreRegiones() {
        this.grafoProbabilistico.aristas.forEach(arista => {
            this.propagarPorArista(arista, false);
        });
        
        if (this.configuracion.permitirReinfecciones && this.grafoProbabilistico.aristasReinfeccion) {
            this.grafoProbabilistico.aristasReinfeccion.forEach(arista => {
                this.propagarPorArista(arista, true);
            });
        }
    }

    propagarPorArista(arista, esReinfeccion) {
        const direcciones = [
            { origen: arista.origen, destino: arista.destino },
            { origen: arista.destino, destino: arista.origen }
        ];
        
        direcciones.forEach(dir => {
            const regionOrigen = this.mundo.obtenerRegionPorId(dir.origen);
            const regionDestino = this.mundo.obtenerRegionPorId(dir.destino);
            
            if (!regionOrigen || !regionDestino || regionOrigen.estadoPoblacion.infectada === 0) return;
            
            if (regionDestino.enCuarentena) return;
            
            const factorOrigen = regionOrigen.estadoPoblacion.infectada / regionOrigen.estadoPoblacion.total;
            const posibilidad = arista.probabilidad * factorOrigen * 0.3;
            
            if (Math.random() < posibilidad) {
                const factorPoblacion = Math.sqrt(regionDestino.estadoPoblacion.total) / 10000;
                let baseInfectados = Math.max(1, Math.floor(factorPoblacion * 10));
                
                if (esReinfeccion) {
                    baseInfectados = Math.max(1, Math.floor(baseInfectados * 0.1));
                }
                
                let nuevosInfectados = baseInfectados;
                if (esReinfeccion) {
                    nuevosInfectados = Math.min(
                        nuevosInfectados,
                        Math.floor(regionDestino.estadoPoblacion.recuperada * 0.1)
                    );
                } else {
                    nuevosInfectados = Math.min(
                        nuevosInfectados,
                        regionDestino.estadoPoblacion.susceptible
                    );
                }
                
                if (nuevosInfectados > 0) {
                    regionDestino.agregarInfeccion(nuevosInfectados, this.fechaActual, esReinfeccion);
                }
            }
        });
    }

    guardarSnapshot() {
        const snapshot = {
            fecha: this.fechaActual,
            regiones: this.mundo.regiones.map(p => ({
                id: p.id,
                nombre: p.nombre,
                estadoPoblacion: { ...p.estadoPoblacion },
                medidasVigentes: [...p.medidasVigentes],
                estadoInfeccioso: p.estadoInfeccioso,
                enCuarentena: p.enCuarentena,
                cohortesInfectados: p.cohortesInfectados.map(c => ({...c})),
                cohortesRecuperados: p.cohortesRecuperados.map(c => ({...c}))
            })),
            enfermedad: {
                nombre: this.enfermedad.nombre,
                tasaContagio: this.enfermedad.tasaContagio,
                tasaMortalidad: this.enfermedad.tasaMortalidad,
                variantes: [...this.enfermedad.variantes]
            }
        };
        this.historial.push(snapshot);
        
        if (this.historial.length > 100) {
            this.historial.shift();
        }
    }

    obtenerEstadisticasGlobales() {
        let totalInfectados = 0, totalFallecidos = 0, totalRecuperados = 0, totalReinfectados = 0;
        let regionesAfectadas = 0, regionesConReinfeccion = 0, regionesEnCuarentena = 0;
        
        this.mundo.regiones.forEach(region => {
            totalInfectados += region.estadoPoblacion.infectada;
            totalFallecidos += region.estadoPoblacion.fallecida;
            totalRecuperados += region.estadoPoblacion.recuperada;
            totalReinfectados += region.estadoPoblacion.reinfectados;
            
            if (region.estadoPoblacion.infectada > 0) regionesAfectadas++;
            if (region.estadoPoblacion.reinfectados > 0) regionesConReinfeccion++;
            if (region.enCuarentena) regionesEnCuarentena++;
        });
        
        let tasaPropagacion = 0;
        if (this.historial.length > 1) {
            const estadoActual = this.historial[this.historial.length - 1];
            const estadoAnterior = this.historial[this.historial.length - 2];
            
            let infectadosActual = 0, infectadosAnterior = 0;
            
            estadoActual.regiones.forEach(p => infectadosActual += p.estadoPoblacion.infectada);
            estadoAnterior.regiones.forEach(p => infectadosAnterior += p.estadoPoblacion.infectada);
            
            if (infectadosAnterior > 0) {
                tasaPropagacion = (infectadosActual - infectadosAnterior) / infectadosAnterior;
            }
        }
        
        return {
            totalInfectados,
            totalFallecidos,
            totalRecuperados,
            totalReinfectados,
            regionesAfectadas,
            regionesConReinfeccion,
            regionesEnCuarentena,
            tasaPropagacion,
            fechaActual: this.fechaActual,
            totalPoblacion: this.mundo.regiones.reduce((sum, r) => sum + r.estadoPoblacion.total, 0)
        };
    }

    predecirProximoDia() {
        const estadisticas = this.obtenerEstadisticasGlobales();
        const crecimiento = estadisticas.tasaPropagacion * 100;
        
        let prediccion = {
            crecimientoEsperado: crecimiento,
            riesgoExpansion: 'BAJO',
            regionesCriticas: []
        };
        
        if (crecimiento > 10) {
            prediccion.riesgoExpansion = 'ALTO';
        } else if (crecimiento > 5) {
            prediccion.riesgoExpansion = 'MEDIO';
        }
        
        this.mundo.regiones.forEach(region => {
            if (region.estadoPoblacion.infectada > region.estadoPoblacion.total * 0.05) {
                prediccion.regionesCriticas.push({
                    nombre: region.nombre,
                    porcentajeInfectado: (region.estadoPoblacion.infectada / region.estadoPoblacion.total * 100).toFixed(1),
                    enCuarentena: region.enCuarentena
                });
            }
        });
        
        return prediccion;
    }
}

// ================================
// CONTROLADOR DE LA APLICACIÓN
// ================================

class ControladorAplicacion {
    constructor() {
        this.mundo = new Mundo('mundo');
        this.enfermedad = new Enfermedad("COVID-19", 30, 2, 14, null);
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        this.intervaloSimulacion = null;
        this.regionSeleccionada = null;
        this.matrizVisible = true;
        this.rutaEditando = null;
        this.tipoRutaSeleccionado = null;
        
        this.mapaPrincipal = null;
        this.mapaAnalisis = null;
        this.capasRegiones = {};
        this.capasRutas = {};
        this.marcadoresRegiones = {};
        
        this.inicializarUI();
        this.inicializarEventos();
    }

    inicializarUI() {
        const selectMapa = document.getElementById('selectorMapa');
        if (selectMapa) {
            selectMapa.value = 'mundo';
        }
        
        this.actualizarListaRegiones();
        this.actualizarSelectorOrigen();
        this.generarMatrizVisual();
        this.inicializarMapas();
        
        const toggleReinfecciones = document.getElementById('toggleReinfecciones');
        if (toggleReinfecciones) {
            toggleReinfecciones.addEventListener('change', (e) => {
                this.simulacion.configuracion.permitirReinfecciones = e.target.checked;
                this.mostrarMensaje(`Reinfecciones ${e.target.checked ? 'activadas' : 'desactivadas'}`);
            });
        }
    }

    inicializarMapas() {
        this.mapaPrincipal = L.map('mapaCanvas').setView([20, 0], 2);
        this.actualizarCapaBase();
        
        this.mapaAnalisis = L.map('mapaAnalisisCanvas').setView([20, 0], 2);
        this.actualizarCapaBaseAnalisis();
        
        this.dibujarMapaPrincipal();
    }

    actualizarCapaBase() {
        if (!this.mapaPrincipal) return;
        
        this.mapaPrincipal.eachLayer(layer => this.mapaPrincipal.removeLayer(layer));
        
        let urlTemplate, atribucion, viewCoords, zoomLevel;
        
        switch(this.mundo.configMapa) {
            case 'mundo':
                urlTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                atribucion = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
                viewCoords = [20, 0];
                zoomLevel = 2;
                break;
            case 'america_latina':
                urlTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                atribucion = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
                viewCoords = [-15, -60];
                zoomLevel = 3;
                break;
            case 'colombia':
                urlTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                atribucion = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
                viewCoords = [4, -74];
                zoomLevel = 5;
                break;
        }
        
        L.tileLayer(urlTemplate, {
            attribution: atribucion,
            maxZoom: 18,
            minZoom: 1
        }).addTo(this.mapaPrincipal);
        
        this.mapaPrincipal.setView(viewCoords, zoomLevel);
    }

    actualizarCapaBaseAnalisis() {
        if (!this.mapaAnalisis) return;
        
        this.mapaAnalisis.eachLayer(layer => this.mapaAnalisis.removeLayer(layer));
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 18,
            minZoom: 1
        }).addTo(this.mapaAnalisis);
    }

    dibujarMapaPrincipal() {
        if (!this.mapaPrincipal || this.mundo.regiones.length === 0) return;
        
        Object.values(this.capasRegiones).forEach(layer => this.mapaPrincipal.removeLayer(layer));
        Object.values(this.capasRutas).forEach(layer => this.mapaPrincipal.removeLayer(layer));
        this.capasRegiones = {};
        this.capasRutas = {};
        this.marcadoresRegiones = {};
        
        this.mundo.rutas.forEach(ruta => {
            const regionOrigen = this.mundo.obtenerRegionPorId(ruta.idOrigen);
            const regionDestino = this.mundo.obtenerRegionPorId(ruta.idDestino);
            
            if (regionOrigen && regionDestino) {
                const latlngs = [
                    [regionOrigen.coordenadas.latitud, regionOrigen.coordenadas.longitud],
                    [regionDestino.coordenadas.latitud, regionDestino.coordenadas.longitud]
                ];
                
                const color = ruta.getColor();
                const dashArray = ruta.cortada ? '5, 10' : null;
                const opacity = ruta.cortada ? 0.3 : 0.7;
                const weight = ruta.cortada ? 2 : 3;
                
                const polyline = L.polyline(latlngs, {
                    color: color,
                    weight: weight,
                    opacity: opacity,
                    dashArray: dashArray,
                    className: 'ruta-line' + (ruta.cortada ? ' inactiva' : '')
                }).addTo(this.mapaPrincipal);
                
                const probabilidad = (ruta.calcularProbabilidadBase() * 100).toFixed(1);
                const icono = ruta.getIconoTipo();
                const estado = ruta.cortada ? '🔒 CORTADA' : '✅ ACTIVA';
                
                polyline.bindTooltip(`
                    <strong>${icono} ${regionOrigen.nombre} ↔ ${regionDestino.nombre}</strong><br>
                    Tipo: ${ruta.tipo}<br>
                    Distancia: ${Math.round(ruta.distancia)} km<br>
                    Probabilidad: ${probabilidad}%<br>
                    Estado: ${estado}
                `);
                
                polyline.on('click', (e) => {
                    this.mostrarInformacionRuta(ruta, regionOrigen, regionDestino);
                });
                
                this.capasRutas[`${ruta.idOrigen}-${ruta.idDestino}`] = polyline;
            }
        });
        
        this.mundo.regiones.forEach(region => {
            const poblacion = region.estadoPoblacion.total / 1000000;
            const radio = Math.max(8, Math.min(20, Math.log10(poblacion) * 5));
            const porcentajeInfectado = (region.estadoPoblacion.infectada / region.estadoPoblacion.total * 100).toFixed(1);
            
            const icono = L.divIcon({
                html: `
                    <div class="region-marker ${region.enCuarentena ? 'cuarentena' : ''}" 
                         style="background-color: ${region.getColorEstado()};
                                width: ${radio * 2}px;
                                height: ${radio * 2}px;
                                border: 2px solid ${region.enCuarentena ? '#673AB7' : '#000'};
                                ${region.estadoPoblacion.reinfectados > 0 ? 'border: 3px solid #9C27B0;' : ''}">
                        <div class="marker-text">${region.getIconoEstado()}</div>
                    </div>
                `,
                className: 'custom-region-marker',
                iconSize: [radio * 2, radio * 2],
                iconAnchor: [radio, radio]
            });
            
            const marker = L.marker(
                [region.coordenadas.latitud, region.coordenadas.longitud],
                { icon: icono }
            ).addTo(this.mapaPrincipal);
            
            let tooltip = `
                <strong>${region.nombre}</strong><br>
                ${region.getIconoEstado()} Estado: ${region.estadoInfeccioso}<br>
                👥 Población: ${Math.round(poblacion * 100) / 100}M<br>
                🤒 Infectados: ${region.estadoPoblacion.infectada.toLocaleString()} (${porcentajeInfectado}%)<br>
            `;
            
            if (region.enCuarentena) {
                tooltip += `🔒 <strong style="color: #673AB7">EN CUARENTENA</strong><br>`;
            }
            
            if (region.estadoPoblacion.reinfectados > 0) {
                tooltip += `🔄 Reinfecciones: ${region.estadoPoblacion.reinfectados.toLocaleString()}<br>`;
            }
            
            tooltip += `<em>Click para más detalles</em>`;
            
            marker.bindTooltip(tooltip);
            
            marker.on('click', () => {
                this.seleccionarRegion(region.id);
            });
            
            marker.on('contextmenu', (e) => {
                e.originalEvent.preventDefault();
                this.mostrarMenuContextualRegion(e.latlng, region);
            });
            
            if (this.regionSeleccionada === region.id) {
                marker.getElement().style.filter = 'brightness(1.2) drop-shadow(0 0 8px gold)';
            }
            
            this.capasRegiones[region.id] = marker;
            this.marcadoresRegiones[region.id] = marker;
        });
    }

    mostrarMenuContextualRegion(latlng, region) {
        const menu = L.popup()
            .setLatLng(latlng)
            .setContent(`
                <div class="context-menu">
                    <h4>${region.nombre}</h4>
                    <button onclick="controlador.aplicarMedidaRegion(${region.id}, 'cuarentena')" 
                            class="context-btn ${region.enCuarentena ? 'active' : ''}">
                        ${region.enCuarentena ? '🔓 Quitar Cuarentena' : '🔒 Poner en Cuarentena'}
                    </button>
                    <button onclick="controlador.aplicarMedidaRegion(${region.id}, 'cierre_fronteras')" 
                            class="context-btn">
                        ${region.medidasVigentes.includes('cierre_fronteras') ? '🌍 Reabrir Fronteras' : '🚫 Cerrar Fronteras'}
                    </button>
                    <button onclick="controlador.aplicarMedidaRegion(${region.id}, 'distanciamiento')" 
                            class="context-btn">
                        ${region.medidasVigentes.includes('distanciamiento') ? '👥 Suspender Distanciamiento' : '↔️ Aplicar Distanciamiento'}
                    </button>
                    <button onclick="controlador.forzarReinfeccion(${region.id})" 
                            class="context-btn reinfeccion-btn">
                        🔄 Forzar Reinfección
                    </button>
                </div>
            `);
        
        menu.openOn(this.mapaPrincipal);
        
        setTimeout(() => {
            this.mapaPrincipal.closePopup();
        }, 10000);
    }

    mostrarInformacionRuta(ruta, regionOrigen, regionDestino) {
        const probabilidad = (ruta.calcularProbabilidadBase() * 100).toFixed(1);
        const probabilidadReinfeccion = (ruta.calcularProbabilidadBase() * 100 * 0.3).toFixed(1);
        
        const contenido = `
            <div class="ruta-info-modal">
                <h3>${ruta.getIconoTipo()} Información de Ruta</h3>
                <div class="ruta-details">
                    <p><strong>Conexión:</strong> ${regionOrigen.nombre} ↔ ${regionDestino.nombre}</p>
                    <p><strong>Tipo:</strong> ${ruta.tipo}</p>
                    <p><strong>Distancia:</strong> ${Math.round(ruta.distancia)} km</p>
                    <p><strong>Tiempo de viaje:</strong> ${Math.round(ruta.tiempoViajePromedio)} horas</p>
                    <p><strong>Tráfico:</strong> ${(ruta.trafico * 100).toFixed(0)}%</p>
                    <p><strong>Estado:</strong> ${ruta.cortada ? '<span style="color:red">🔒 CORTADA</span>' : '<span style="color:green">✅ ACTIVA</span>'}</p>
                    <p><strong>Probabilidad de contagio:</strong> ${probabilidad}%</p>
                    <p><strong>Probabilidad de reinfección:</strong> ${probabilidadReinfeccion}%</p>
                </div>
                <div class="ruta-actions">
                    <button onclick="controlador.toggleRuta(${ruta.idOrigen}, ${ruta.idDestino})" 
                            class="btn-small ${ruta.cortada ? 'btn-success' : 'btn-warning'}">
                        ${ruta.cortada ? '🔓 Reactivar Ruta' : '🔒 Cortar Ruta'}
                    </button>
                    <button onclick="controlador.editarRutaDesdeMapa(${ruta.idOrigen}, ${ruta.idDestino})" 
                            class="btn-small">
                        ✏️ Cambiar Tipo
                    </button>
                </div>
            </div>
        `;
        
        this.mostrarModalPersonalizado('Información de Ruta', contenido);
    }

    mostrarModalPersonalizado(titulo, contenido) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalPersonalizado';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3>${titulo}</h3>
                <div class="modal-body">
                    ${contenido}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    toggleRuta(idOrigen, idDestino) {
        const clave = `${Math.min(idOrigen, idDestino)}-${Math.max(idOrigen, idDestino)}`;
        const ruta = this.mundo.tablaRutas.get(clave);
        
        if (ruta) {
            if (ruta.cortada) {
                ruta.restaurar();
                this.mostrarMensaje(`✅ Ruta reactivada: ${this.mundo.obtenerRegionPorId(idOrigen).nombre} ↔ ${this.mundo.obtenerRegionPorId(idDestino).nombre}`);
            } else {
                ruta.cortar();
                this.mostrarMensaje(`🔒 Ruta cortada: ${this.mundo.obtenerRegionPorId(idOrigen).nombre} ↔ ${this.mundo.obtenerRegionPorId(idDestino).nombre}`);
            }
            
            this.dibujarMapaPrincipal();
            this.generarMatrizVisual();
            this.actualizarUI();
        }
    }

    editarRutaDesdeMapa(idOrigen, idDestino) {
        const regionOrigen = this.mundo.obtenerRegionPorId(idOrigen);
        const regionDestino = this.mundo.obtenerRegionPorId(idDestino);
        
        const clave = `${Math.min(idOrigen, idDestino)}-${Math.max(idOrigen, idDestino)}`;
        const rutaExistente = this.mundo.tablaRutas.get(clave);
        
        this.rutaEditando = {
            fila: Math.min(idOrigen, idDestino),
            columna: Math.max(idOrigen, idDestino),
            regionOrigenId: idOrigen,
            regionDestinoId: idDestino,
            tipoActual: rutaExistente ? rutaExistente.tipo : null,
            celda: null
        };
        
        this.mostrarModalTipoRuta(regionOrigen.nombre, regionDestino.nombre, rutaExistente);
    }

    inicializarEventos() {
        document.getElementById('btnPlayPause').addEventListener('click', () => this.toggleSimulacion());
        document.getElementById('btnStep').addEventListener('click', () => this.avanzarPaso());
        document.getElementById('btnReset').addEventListener('click', () => this.reiniciarSimulacion());
        document.getElementById('velocidadSlider').addEventListener('input', (e) => this.ajustarVelocidad(e.target.value));
        
        document.getElementById('tasaContagio').addEventListener('input', (e) => {
            document.getElementById('valorContagio').textContent = e.target.value + '%';
        });
        document.getElementById('tasaMortalidad').addEventListener('input', (e) => {
            document.getElementById('valorMortalidad').textContent = e.target.value + '%';
        });
        document.getElementById('btnAplicarEnfermedad').addEventListener('click', () => this.aplicarConfiguracionEnfermedad());
        
        document.getElementById('btnToggleMatriz').addEventListener('click', () => this.toggleMatriz());
        document.getElementById('btnEditarMatriz').addEventListener('click', () => this.activarEdicionMatriz());
        
        document.getElementById('btnPredecir30').addEventListener('click', () => this.predecir30Dias());
        document.getElementById('btnRegionesRiesgo').addEventListener('click', () => this.identificarRegionesRiesgo());
        document.getElementById('btnRutasCriticas').addEventListener('click', () => this.identificarRutasCriticas());
        document.getElementById('btnFiltrarAereo').addEventListener('click', () => this.filtrarRutasAereas());
        
        document.querySelector('.close-modal').addEventListener('click', () => this.cerrarModal());
        window.addEventListener('click', (e) => {
            if (e.target.id === 'modalRegion') this.cerrarModal();
        });
        
        const selectorMapa = document.getElementById('selectorMapa');
        if (selectorMapa) {
            selectorMapa.addEventListener('change', (e) => {
                this.cambiarMapa(e.target.value);
            });
        }
        
        this.inicializarEventosTipoRuta();
        this.actualizarUI();
    }

    inicializarEventosTipoRuta() {
        document.querySelectorAll('.tipo-ruta-opcion').forEach(opcion => {
            opcion.addEventListener('click', () => {
                document.querySelectorAll('.tipo-ruta-opcion').forEach(o => {
                    o.classList.remove('seleccionada');
                });
                opcion.classList.add('seleccionada');
                this.tipoRutaSeleccionado = opcion.dataset.tipo;
                
                const btnEliminar = document.getElementById('btnEliminarRuta');
                if (this.rutaEditando && this.rutaEditando.tipoActual) {
                    btnEliminar.style.display = 'inline-block';
                }
            });
        });
        
        document.getElementById('btnEliminarRuta').addEventListener('click', () => {
            if (this.rutaEditando) this.eliminarRutaDesdeModal();
        });
    }

    cambiarMapa(tipoMapa) {
        this.detenerSimulacion();
        
        this.mundo = new Mundo(tipoMapa);
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        
        this.actualizarSelectorOrigen();
        this.actualizarListaRegiones();
        this.generarMatrizVisual();
        this.actualizarCapaBase();
        this.dibujarMapaPrincipal();
        this.dibujarMapaAnalisis();
        this.actualizarUI();
        
        const mapaNombre = tipoMapa === 'mundo' ? 'Mapa Mundial' : 
                         tipoMapa === 'america_latina' ? 'América Latina' : 
                         'Colombia (Departamentos)';
        document.getElementById('mapaActual').textContent = `Mapa: ${mapaNombre}`;
        this.mostrarMensaje(`Mapa cambiado a: ${mapaNombre}`);
    }

    detenerSimulacion() {
        clearInterval(this.intervaloSimulacion);
        if (this.simulacion) {
            this.simulacion.configuracion.pausada = true;
        }
        document.getElementById('btnPlayPause').innerHTML = '<i class="fas fa-play"></i> Iniciar';
        document.getElementById('estadoSimulacion').textContent = 'Estado: Detenido';
    }

    toggleSimulacion() {
        const btn = document.getElementById('btnPlayPause');
        
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
        const intervalo = 1000 / velocidad;
        
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
        
        this.enfermedad = new Enfermedad(
            document.getElementById('nombreEnfermedad').value,
            parseFloat(document.getElementById('tasaContagio').value),
            parseFloat(document.getElementById('tasaMortalidad').value),
            parseInt(document.getElementById('tiempoRecuperacion').value),
            parseInt(document.getElementById('regionOrigen').value)
        );
        
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        
        document.getElementById('btnPlayPause').innerHTML = '<i class="fas fa-play"></i> Iniciar';
        document.getElementById('estadoSimulacion').textContent = 'Estado: Reiniciado';
        document.getElementById('fechaActual').textContent = 'Día: 0';
        
        this.actualizarUI();
    }

    ajustarVelocidad(valor) {
        this.simulacion.configuracion.velocidad = valor;
        if (!this.simulacion.configuracion.pausada) this.iniciarSimulacion();
    }

    aplicarConfiguracionEnfermedad() {
        const viasSeleccionadas = [];
        document.querySelectorAll('input[name="via"]:checked').forEach(checkbox => {
            viasSeleccionadas.push(checkbox.value);
        });
        
        this.enfermedad.nombre = document.getElementById('nombreEnfermedad').value;
        this.enfermedad.tasaContagio = parseFloat(document.getElementById('tasaContagio').value) / 100;
        this.enfermedad.tasaMortalidad = parseFloat(document.getElementById('tasaMortalidad').value) / 100;
        this.enfermedad.tiempoRecuperacion = parseInt(document.getElementById('tiempoRecuperacion').value);
        this.enfermedad.regionOrigen = parseInt(document.getElementById('regionOrigen').value);
        this.enfermedad.viaPrevaleciente = viasSeleccionadas;
        
        this.simulacion = new Simulacion(this.mundo, this.enfermedad);
        this.actualizarUI();
        this.mostrarMensaje('✅ Configuración de enfermedad aplicada');
    }

    actualizarUI() {
        document.getElementById('fechaActual').textContent = `Día: ${this.simulacion.fechaActual}`;
        
        const stats = this.simulacion.obtenerEstadisticasGlobales();
        document.getElementById('totalInfectados').textContent = stats.totalInfectados.toLocaleString();
        document.getElementById('totalFallecidos').textContent = stats.totalFallecidos.toLocaleString();
        document.getElementById('regionesAfectadas').textContent = stats.regionesAfectadas;
        document.getElementById('reinfecciones').textContent = stats.totalReinfectados.toLocaleString();
        
        const tasaElement = document.getElementById('tasaPropagacion');
        const tasaValor = stats.tasaPropagacion * 100;
        
        if (tasaValor < 0) {
            tasaElement.textContent = `Tasa de Curación: ${Math.abs(tasaValor).toFixed(2)}%`;
            tasaElement.style.color = '#27ae60';
        } else {
            tasaElement.textContent = `Tasa de Propagación: ${tasaValor.toFixed(2)}%`;
            tasaElement.style.color = '#e74c3c';
        }
        
        document.getElementById('contadorRegiones').textContent = `Regiones: ${this.mundo.regiones.length}`;
        const statsRutas = this.mundo.obtenerEstadisticasRutas();
        document.getElementById('contadorRutas').textContent = `Rutas: ${statsRutas.totalRutas} (${statsRutas.rutasCortadas} cortadas)`;
        
        this.dibujarMapaPrincipal();
        this.actualizarListaRegiones();
        
        const prediccion = this.simulacion.predecirProximoDia();
        document.getElementById('estadoSimulacion').textContent = 
            `Estado: ${this.simulacion.configuracion.pausada ? 'Pausado' : 'Ejecutando'} | Riesgo: ${prediccion.riesgoExpansion}`;
    }

    actualizarListaRegiones() {
        const lista = document.getElementById('listaRegiones');
        if (!lista) return;
        
        lista.innerHTML = '';
        
        this.mundo.regiones.forEach(region => {
            const item = document.createElement('div');
            item.className = `region-item ${this.regionSeleccionada === region.id ? 'seleccionado' : ''}`;
            item.dataset.id = region.id;
            
            const tieneReinfecciones = region.estadoPoblacion.reinfectados > 0;
            const porcentajeInfectado = (region.estadoPoblacion.infectada / region.estadoPoblacion.total * 100).toFixed(1);
            
            const iconoReinfeccion = tieneReinfecciones ? 
                '<span class="reinfeccion-indicator" title="Tiene reinfecciones">🔄</span>' : '';
            const iconoCuarentena = region.enCuarentena ? 
                '<span class="cuarentena-indicator" title="En cuarentena">🔒</span>' : '';
            
            item.innerHTML = `
                <div class="region-info">
                    <div class="estado-region" style="background-color: ${region.getColorEstado()}"></div>
                    <span>${region.nombre}</span>
                    ${iconoCuarentena}
                    ${iconoReinfeccion}
                </div>
                <div class="region-estadisticas">
                    <small>${porcentajeInfectado}% infectados</small>
                    ${tieneReinfecciones ? 
                        `<small class="reinfeccion-count">${region.estadoPoblacion.reinfectados.toLocaleString()} reinf</small>` : ''}
                </div>
            `;
            
            item.addEventListener('click', () => this.seleccionarRegion(region.id));
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.mostrarMenuContextualLista(e, region);
            });
            
            lista.appendChild(item);
        });
    }

    mostrarMenuContextualLista(e, region) {
        const menu = document.createElement('div');
        menu.className = 'context-menu-flotante';
        menu.style.position = 'fixed';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.zIndex = '1000';
        menu.style.background = 'white';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '5px';
        menu.style.padding = '10px';
        menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        
        menu.innerHTML = `
            <h4>${region.nombre}</h4>
            <button onclick="controlador.aplicarMedidaRegion(${region.id}, 'cuarentena'); this.parentElement.remove()" 
                    class="context-btn ${region.enCuarentena ? 'active' : ''}">
                ${region.enCuarentena ? '🔓 Quitar Cuarentena' : '🔒 Poner en Cuarentena'}
            </button>
            <button onclick="controlador.aplicarMedidaRegion(${region.id}, 'cierre_fronteras'); this.parentElement.remove()" 
                    class="context-btn">
                ${region.medidasVigentes.includes('cierre_fronteras') ? '🌍 Reabrir Fronteras' : '🚫 Cerrar Fronteras'}
            </button>
            <button onclick="controlador.forzarReinfeccion(${region.id}); this.parentElement.remove()" 
                    class="context-btn reinfeccion-btn">
                🔄 Forzar Reinfección
            </button>
        `;
        
        document.body.appendChild(menu);
        
        const cerrarMenu = () => {
            if (menu && menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        };
        
        menu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', cerrarMenu);
        document.addEventListener('contextmenu', cerrarMenu);
        
        setTimeout(cerrarMenu, 10000);
    }

    actualizarSelectorOrigen() {
        const select = document.getElementById('regionOrigen');
        if (!select) return;
        
        select.innerHTML = '<option value="null">Seleccionar...</option>';
        
        this.mundo.regiones.forEach(region => {
            const option = document.createElement('option');
            option.value = region.id;
            option.textContent = region.nombre;
            select.appendChild(option);
        });
    }

    seleccionarRegion(id) {
        this.regionSeleccionada = id;
        this.actualizarListaRegiones();
        
        const region = this.mundo.obtenerRegionPorId(id);
        if (region) {
            this.mostrarInformacionRegion(region);
            
            if (this.marcadoresRegiones[id]) {
                const marker = this.marcadoresRegiones[id];
                const latlng = marker.getLatLng();
                this.mapaPrincipal.setView(latlng, Math.max(this.mapaPrincipal.getZoom(), 6));
            }
        }
    }

    mostrarInformacionRegion(region) {
        const porcentajeInfectado = (region.estadoPoblacion.infectada / region.estadoPoblacion.total) * 100;
        const porcentajeRecuperado = (region.estadoPoblacion.recuperada / region.estadoPoblacion.total) * 100;
        const porcentajeFallecido = (region.estadoPoblacion.fallecida / region.estadoPoblacion.total) * 100;
        const porcentajeSusceptible = (region.estadoPoblacion.susceptible / region.estadoPoblacion.total) * 100;
        const porcentajeReinfectado = (region.estadoPoblacion.reinfectados / region.estadoPoblacion.total) * 100;
        
        const rutasConectadas = this.mundo.obtenerRutasActivasConectadas(region.id);
        const rutasCortadas = this.mundo.obtenerRutasConectadas(region.id).filter(r => r.cortada);
        
        document.getElementById('modalRegionTitulo').textContent = `📊 ${region.nombre}`;
        document.getElementById('modalRegionContenido').innerHTML = `
            <div class="modal-stats">
                <div class="modal-stat">
                    <span class="modal-label">👥 Población Total:</span>
                    <span class="modal-value">${Math.round(region.estadoPoblacion.total / 1000000 * 100) / 100} millones</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">🟢 Susceptibles:</span>
                    <span class="modal-value" style="color: #4CAF50">${region.estadoPoblacion.susceptible.toLocaleString()} (${porcentajeSusceptible.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">🔴 Infectados:</span>
                    <span class="modal-value" style="color: #F44336">${region.estadoPoblacion.infectada.toLocaleString()} (${porcentajeInfectado.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">🔵 Recuperados:</span>
                    <span class="modal-value" style="color: #2196F3">${region.estadoPoblacion.recuperada.toLocaleString()} (${porcentajeRecuperado.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">⚫ Fallecidos:</span>
                    <span class="modal-value">${region.estadoPoblacion.fallecida.toLocaleString()} (${porcentajeFallecido.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">🔄 Reinfecciones:</span>
                    <span class="modal-value" style="color: #9C27B0">${region.estadoPoblacion.reinfectados.toLocaleString()} (${porcentajeReinfectado.toFixed(2)}%)</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">${region.getIconoEstado()} Estado:</span>
                    <span class="modal-value" style="color: ${region.getColorEstado()}">${region.estadoInfeccioso}</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">📊 Factor Transmisión:</span>
                    <span class="modal-value">${region.factorTransmision.toFixed(3)}</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-label">${region.enCuarentena ? '🔒' : '🔓'} En Cuarentena:</span>
                    <span class="modal-value" style="color: ${region.enCuarentena ? '#673AB7' : '#4CAF50'}">${region.enCuarentena ? 'SÍ' : 'NO'}</span>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>🛡️ Medidas Vigentes:</h4>
                ${region.medidasVigentes.length > 0 ? 
                    `<ul>${region.medidasVigentes.map(m => `<li>${this.formatearMedida(m)}</li>`).join('')}</ul>` : 
                    '<p>No hay medidas activas</p>'}
            </div>
            
            <div class="modal-section">
                <h4>🛣️ Conexiones Activas (${rutasConectadas.length}):</h4>
                ${rutasConectadas.length > 0 ? 
                    `<ul>${rutasConectadas.map(r => {
                        const otraRegion = this.mundo.obtenerRegionPorId(r.regionConectadaId);
                        const direccion = r.direccion === 'salida' ? '→' : '←';
                        const prob = (r.calcularProbabilidadBase() * 100).toFixed(1);
                        const probReinfeccion = (r.calcularProbabilidadBase() * 100 * 0.3).toFixed(1);
                        return `<li>${direccion} ${otraRegion.nombre} (${r.getIconoTipo()} ${r.tipo}, Prob: ${prob}%, Reinfección: ${probReinfeccion}%)</li>`;
                    }).join('')}</ul>` : 
                    '<p>No tiene conexiones activas</p>'}
            </div>
            
            ${rutasCortadas.length > 0 ? `
            <div class="modal-section">
                <h4>🔒 Conexiones Cortadas (${rutasCortadas.length}):</h4>
                <ul>${rutasCortadas.map(r => {
                    const otraRegion = this.mundo.obtenerRegionPorId(r.regionConectadaId);
                    const direccion = r.direccion === 'salida' ? '→' : '←';
                    return `<li style="color: #999; text-decoration: line-through;">${direccion} ${otraRegion.nombre} (${r.getIconoTipo()} ${r.tipo})</li>`;
                }).join('')}</ul>
            </div>` : ''}
            
            <div class="modal-actions">
                <button class="btn-small" onclick="controlador.aplicarMedidaRegion(${region.id}, 'cuarentena')">
                    ${region.enCuarentena ? '🔓 Quitar Cuarentena' : '🔒 Poner en Cuarentena'}
                </button>
                <button class="btn-small" onclick="controlador.aplicarMedidaRegion(${region.id}, 'cierre_fronteras')">
                    ${region.medidasVigentes.includes('cierre_fronteras') ? '🌍 Reabrir Fronteras' : '🚫 Cerrar Fronteras'}
                </button>
                <button class="btn-small" onclick="controlador.aplicarMedidaRegion(${region.id}, 'distanciamiento')">
                    ${region.medidasVigentes.includes('distanciamiento') ? '👥 Suspender Distanciamiento' : '↔️ Aplicar Distanciamiento'}
                </button>
                <button class="btn-small" onclick="controlador.aplicarMedidaRegion(${region.id}, 'mascarillas')">
                    ${region.medidasVigentes.includes('mascarillas') ? '😷 Suspender Mascarillas' : '😷 Aplicar Mascarillas'}
                </button>
                <button class="btn-small" onclick="controlador.aplicarMedidaRegion(${region.id}, 'vacunacion')">
                    ${region.medidasVigentes.includes('vacunacion') ? '💉 Suspender Vacunación' : '💉 Aplicar Vacunación'}
                </button>
                <button class="btn-small" onclick="controlador.forzarReinfeccion(${region.id})" 
                        style="background-color: #9C27B0; color: white">
                    🔄 Forzar Reinfección (Test)
                </button>
            </div>
        `;
        
        document.getElementById('modalRegion').style.display = 'flex';
    }

    aplicarMedidaRegion(id, medida) {
        const region = this.mundo.obtenerRegionPorId(id);
        if (!region) return;
        
        if (medida === 'cuarentena') {
            const nuevaCuarentena = !region.enCuarentena;
            region.toggleCuarentena(nuevaCuarentena);
            
            if (nuevaCuarentena) {
                this.mundo.cortarRutasRegion(id);
                this.mostrarMensaje(`✅ ${region.nombre} puesta en cuarentena. Todas sus rutas han sido cortadas.`);
            } else {
                this.mundo.restaurarRutasRegion(id);
                this.mostrarMensaje(`✅ Cuarentena removida de ${region.nombre}. Rutas restauradas.`);
            }
        } else {
            if (region.medidasVigentes.includes(medida)) {
                region.removerMedida(medida);
                this.mostrarMensaje(`✅ Medida "${this.formatearMedida(medida)}" removida de ${region.nombre}`);
            } else {
                region.aplicarMedida(medida);
                this.mostrarMensaje(`✅ Medida "${this.formatearMedida(medida)}" aplicada en ${region.nombre}`);
            }
        }
        
        if (this.regionSeleccionada === id) {
            this.mostrarInformacionRegion(region);
        }
        
        this.actualizarUI();
    }

    forzarReinfeccion(regionId) {
        const region = this.mundo.obtenerRegionPorId(regionId);
        if (region && region.estadoPoblacion.recuperada > 0 && !region.enCuarentena) {
            const cantidad = Math.max(1, Math.floor(region.estadoPoblacion.recuperada * 0.01));
            region.agregarInfeccion(cantidad, this.simulacion.fechaActual, true);
            
            if (this.regionSeleccionada === regionId) {
                this.mostrarInformacionRegion(region);
            }
            
            this.mostrarMensaje(`🔄 ${cantidad.toLocaleString()} reinfecciones forzadas en ${region.nombre}`);
            this.actualizarUI();
        } else if (region.enCuarentena) {
            this.mostrarMensaje('❌ No se pueden forzar reinfecciones en regiones en cuarentena', true);
        } else {
            this.mostrarMensaje('❌ No hay recuperados para reinfectar', true);
        }
    }

    formatearMedida(medida) {
        const nombres = {
            'cuarentena': 'Cuarentena Total',
            'cierre_fronteras': 'Cierre de Fronteras',
            'distanciamiento': 'Distanciamiento Social',
            'mascarillas': 'Uso de Mascarillas',
            'vacunacion': 'Campaña de Vacunación'
        };
        return nombres[medida] || medida;
    }

    cerrarModal() {
        document.getElementById('modalRegion').style.display = 'none';
    }

    generarMatrizVisual() {
        const matrizContainer = document.getElementById('matrizContainer');
        if (!matrizContainer || this.mundo.regiones.length === 0) {
            matrizContainer.innerHTML = '<div class="matriz-overlay"><p>Selecciona un mapa para ver la matriz</p></div>';
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
                    const region = this.mundo.regiones[j-1];
                    html += `<th class="matriz-encabezado" title="${region.nombre}">${celda}</th>`;
                } else if (j === 0) {
                    const region = this.mundo.regiones[i-1];
                    html += `<th class="matriz-encabezado" title="${region.nombre}">${celda}</th>`;
                } else {
                    const clave = `${Math.min(i-1, j-1)}-${Math.max(i-1, j-1)}`;
                    const ruta = this.mundo.tablaRutas.get(clave);
                    
                    let claseBase, valor, titulo = '';
                    
                    if (ruta) {
                        if (ruta.cortada) {
                            claseBase = 'matriz-celda-inactiva celda-cortada';
                            valor = 'X';
                            titulo = `RUTA CORTADA\n${this.mundo.regiones[i-1].nombre} ↔ ${this.mundo.regiones[j-1].nombre}`;
                        } else {
                            claseBase = 'matriz-celda-activa';
                            valor = '1';
                            
                            const regionOrigen = this.mundo.regiones[i-1];
                            const regionDestino = this.mundo.regiones[j-1];
                            const probabilidad = (ruta.calcularProbabilidadBase() * 100).toFixed(1);
                            const probabilidadReinfeccion = (ruta.calcularProbabilidadBase() * 100 * 0.3).toFixed(1);
                            
                            titulo = `${regionOrigen.nombre} ↔ ${regionDestino.nombre}\n` +
                                    `Tipo: ${ruta.tipo}\n` +
                                    `Distancia: ${Math.round(ruta.distancia)} km\n` +
                                    `Prob. contagio: ${probabilidad}%\n` +
                                    `Prob. reinfección: ${probabilidadReinfeccion}%`;
                            
                            switch(ruta.tipo) {
                                case 'AEREO': claseBase += ' celda-aerea'; break;
                                case 'TERRESTRE': claseBase += ' celda-terrestre'; break;
                                case 'MARITIMO': claseBase += ' celda-maritima'; break;
                            }
                        }
                    } else {
                        claseBase = 'matriz-celda-inactiva';
                        valor = '0';
                    }
                    
                    html += `<td class="matriz-celda ${claseBase}" 
                            data-fila="${i-1}" 
                            data-columna="${j-1}"
                            id="celda-${i-1}-${j-1}"
                            title="${titulo}">${valor}</td>`;
                }
            });
            html += '</tr>';
        });
        
        html += '</table>';
        matrizContainer.innerHTML = html;
        
        this.agregarEventosMatriz();
    }

    agregarEventosMatriz() {
        document.querySelectorAll('.matriz-celda').forEach(celda => {
            celda.addEventListener('click', (e) => {
                const fila = parseInt(celda.dataset.fila);
                const columna = parseInt(celda.dataset.columna);
                
                if (fila === columna) return;
                if (columna <= fila) {
                    this.mostrarMensaje('Modifica solo la diagonal superior (matriz simétrica)', true);
                    return;
                }
                
                this.manejarClicCeldaMatriz(fila, columna, celda);
            });
        });
    }

    manejarClicCeldaMatriz(fila, columna, celda) {
        const regionOrigen = this.mundo.regiones[fila];
        const regionDestino = this.mundo.regiones[columna];
        
        const clave = `${Math.min(fila, columna)}-${Math.max(fila, columna)}`;
        const rutaExistente = this.mundo.tablaRutas.get(clave);
        
        this.rutaEditando = {
            fila, columna,
            regionOrigenId: regionOrigen.id,
            regionDestinoId: regionDestino.id,
            tipoActual: rutaExistente ? rutaExistente.tipo : null,
            celda: celda
        };
        
        this.mostrarModalTipoRuta(regionOrigen.nombre, regionDestino.nombre, rutaExistente);
    }

    mostrarModalTipoRuta(nombreOrigen, nombreDestino, rutaExistente) {
        const rutaRegiones = document.getElementById('rutaRegiones');
        if (rutaRegiones) rutaRegiones.textContent = `${nombreOrigen} ↔ ${nombreDestino}`;
        
        const btnEliminar = document.getElementById('btnEliminarRuta');
        if (btnEliminar) {
            if (rutaExistente) {
                btnEliminar.style.display = 'inline-block';
                btnEliminar.textContent = `Eliminar Ruta ${rutaExistente.tipo}`;
                
                document.querySelectorAll('.tipo-ruta-opcion').forEach(opcion => {
                    opcion.classList.remove('seleccionada');
                    if (opcion.dataset.tipo === rutaExistente.tipo) {
                        opcion.classList.add('seleccionada');
                        this.tipoRutaSeleccionado = rutaExistente.tipo;
                    }
                });
            } else {
                btnEliminar.style.display = 'none';
                document.querySelectorAll('.tipo-ruta-opcion').forEach(opcion => {
                    opcion.classList.remove('seleccionada');
                });
                this.tipoRutaSeleccionado = null;
            }
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
        
        const { fila, columna, regionOrigenId, regionDestinoId, celda } = this.rutaEditando;
        const regionOrigen = this.mundo.regiones[fila];
        const regionDestino = this.mundo.regiones[columna];
        
        const clave = `${Math.min(fila, columna)}-${Math.max(fila, columna)}`;
        const rutaExistente = this.mundo.tablaRutas.get(clave);
        
        if (rutaExistente) {
            rutaExistente.tipo = this.tipoRutaSeleccionado;
        } else {
            const trafico = Math.random() * 0.5 + 0.3;
            this.mundo.agregarRuta(regionOrigenId, regionDestinoId, this.tipoRutaSeleccionado, trafico);
        }
        
        this.generarMatrizVisual();
        this.dibujarMapaPrincipal();
        this.mostrarMensaje(`✅ Ruta ${rutaExistente ? 'actualizada' : 'creada'}: ${regionOrigen.nombre} ↔ ${regionDestino.nombre} (${this.tipoRutaSeleccionado})`);
        this.cerrarModalTipoRuta();
    }

    eliminarRutaDesdeModal() {
        if (!this.rutaEditando) return;
        
        const { fila, columna, regionOrigenId, regionDestinoId } = this.rutaEditando;
        const regionOrigen = this.mundo.regiones[fila];
        const regionDestino = this.mundo.regiones[columna];
        
        this.mundo.eliminarRuta(regionOrigenId, regionDestinoId);
        
        this.generarMatrizVisual();
        this.dibujarMapaPrincipal();
        this.mostrarMensaje(`✅ Ruta eliminada: ${regionOrigen.nombre} ↔ ${regionDestino.nombre}`);
        this.cerrarModalTipoRuta();
    }

    activarEdicionMatriz() {
        const btn = document.getElementById('btnEditarMatriz');
        const celdas = document.querySelectorAll('.matriz-celda');
        
        if (btn.innerHTML.includes('fa-edit')) {
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            celdas.forEach(celda => {
                if (!celda.classList.contains('matriz-corner') && !celda.classList.contains('matriz-encabezado')) {
                    celda.style.cursor = 'pointer';
                    celda.style.backgroundColor = celda.classList.contains('matriz-celda-activa') ? 
                        'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.1)';
                }
            });
            this.mostrarMensaje('✏️ Modo edición activado. Haz clic en las celdas para modificar rutas.');
        } else {
            btn.innerHTML = '<i class="fas fa-edit"></i> Modo Edición';
            celdas.forEach(celda => {
                celda.style.cursor = 'default';
                celda.style.backgroundColor = '';
            });
            this.mostrarMensaje('💾 Cambios en la matriz guardados');
        }
    }

    toggleMatriz() {
        const matrizContainer = document.getElementById('matrizContainer');
        const btnToggle = document.getElementById('btnToggleMatriz');
        
        if (matrizContainer.style.display === 'none') {
            matrizContainer.style.display = 'block';
            btnToggle.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Matriz';
            this.generarMatrizVisual();
        } else {
            matrizContainer.style.display = 'none';
            btnToggle.innerHTML = '<i class="fas fa-eye"></i> Mostrar Matriz';
        }
    }

    predecir30Dias() {
        if (!this.simulacion) return;
        
        const mundoCopia = new Mundo(this.mundo.configMapa);
        
        this.mundo.regiones.forEach(regionOriginal => {
            const regionCopia = mundoCopia.regiones.find(p => p.nombre === regionOriginal.nombre);
            if (regionCopia) {
                regionCopia.estadoPoblacion = { ...regionOriginal.estadoPoblacion };
                regionCopia.medidasVigentes = [...regionOriginal.medidasVigentes];
                regionCopia.estadoInfeccioso = regionOriginal.estadoInfeccioso;
                regionCopia.factorTransmision = regionOriginal.factorTransmision;
                regionCopia.enCuarentena = regionOriginal.enCuarentena;
                regionCopia.cohortesInfectados = regionOriginal.cohortesInfectados.map(c => ({...c}));
                regionCopia.cohortesRecuperados = regionOriginal.cohortesRecuperados.map(c => ({...c}));
            }
        });
        
        const enfermedadCopia = new Enfermedad(
            this.enfermedad.nombre,
            this.enfermedad.tasaContagio * 100,
            this.enfermedad.tasaMortalidad * 100,
            this.enfermedad.tiempoRecuperacion,
            this.enfermedad.regionOrigen
        );
        enfermedadCopia.viaPrevaleciente = [...this.enfermedad.viaPrevaleciente];
        enfermedadCopia.factorReduccionReinfeccion = this.enfermedad.factorReduccionReinfeccion;
        
        const simPrediccion = new Simulacion(mundoCopia, enfermedadCopia);
        simPrediccion.fechaActual = this.simulacion.fechaActual;
        simPrediccion.configuracion.permitirReinfecciones = this.simulacion.configuracion.permitirReinfecciones;
        
        for (let i = 0; i < 30; i++) simPrediccion.avanzarUnDia();
        
        const stats = simPrediccion.obtenerEstadisticasGlobales();
        const regionesMasAfectadas = simPrediccion.mundo.regiones
            .filter(p => p.estadoPoblacion.infectada > 0)
            .sort((a, b) => b.estadoPoblacion.infectada - a.estadoPoblacion.infectada)
            .slice(0, 5);
        
        const regionesConMasReinfecciones = simPrediccion.mundo.regiones
            .filter(p => p.estadoPoblacion.reinfectados > 0)
            .sort((a, b) => b.estadoPoblacion.reinfectados - a.estadoPoblacion.reinfectados)
            .slice(0, 3);
        
        let resultadoHTML = `<h4>📈 Predicción para Día ${this.simulacion.fechaActual + 30}:</h4>`;
        resultadoHTML += `<p><strong>Total Infectados:</strong> ${stats.totalInfectados.toLocaleString()}</p>`;
        resultadoHTML += `<p><strong>Total Fallecidos:</strong> ${stats.totalFallecidos.toLocaleString()}</p>`;
        resultadoHTML += `<p><strong>Total Reinfecciones:</strong> ${stats.totalReinfectados.toLocaleString()}</p>`;
        resultadoHTML += `<p><strong>Regiones Afectadas:</strong> ${stats.regionesAfectadas}</p>`;
        resultadoHTML += `<p><strong>Regiones con Reinfección:</strong> ${stats.regionesConReinfeccion}</p>`;
        resultadoHTML += `<p><strong>Regiones en Cuarentena:</strong> ${stats.regionesEnCuarentena}</p>`;
        
        const tasaPrediccion = stats.tasaPropagacion * 100;
        if (tasaPrediccion < 0) {
            resultadoHTML += `<p><strong>Tasa de Curación:</strong> ${Math.abs(tasaPrediccion).toFixed(2)}%</p>`;
        } else {
            resultadoHTML += `<p><strong>Tasa Propagación:</strong> ${tasaPrediccion.toFixed(2)}%</p>`;
        }
        
        resultadoHTML += `<h4>🔥 Regiones más afectadas:</h4><ul>`;
        regionesMasAfectadas.forEach(region => {
            const porcentaje = (region.estadoPoblacion.infectada / region.estadoPoblacion.total) * 100;
            const reinfecciones = region.estadoPoblacion.reinfectados > 0 ? 
                ` (🔄 ${region.estadoPoblacion.reinfectados.toLocaleString()} reinfecciones)` : '';
            const cuarentena = region.enCuarentena ? ' [🔒 CUARENTENA]' : '';
            resultadoHTML += `<li>${region.nombre}: ${region.estadoPoblacion.infectada.toLocaleString()} infectados${reinfecciones}${cuarentena} (${porcentaje.toFixed(1)}%)</li>`;
        });
        resultadoHTML += `</ul>`;
        
        if (regionesConMasReinfecciones.length > 0) {
            resultadoHTML += `<h4>🔄 Regiones con más reinfecciones:</h4><ul>`;
            regionesConMasReinfecciones.forEach(region => {
                const porcentaje = (region.estadoPoblacion.reinfectados / region.estadoPoblacion.total) * 100;
                resultadoHTML += `<li>${region.nombre}: ${region.estadoPoblacion.reinfectados.toLocaleString()} reinfecciones (${porcentaje.toFixed(2)}%)</li>`;
            });
            resultadoHTML += `</ul>`;
        }
        
        document.getElementById('resultadosAnalisis').innerHTML = resultadoHTML;
        
        this.dibujarMapaAnalisisPrediccion(simPrediccion);
        this.mostrarMensaje('📊 Predicción de 30 días generada (incluye reinfecciones y cuarentenas)');
    }

    dibujarMapaAnalisisPrediccion(simulacionAnalisis) {
        if (!this.mapaAnalisis) return;
        
        this.mapaAnalisis.eachLayer(layer => {
            if (!layer._url) {
                this.mapaAnalisis.removeLayer(layer);
            }
        });
        
        simulacionAnalisis.mundo.regiones.forEach(region => {
            const porcentajeInfectado = (region.estadoPoblacion.infectada / region.estadoPoblacion.total) * 100;
            const tieneReinfecciones = region.estadoPoblacion.reinfectados > 0;
            const enCuarentena = region.enCuarentena;
            
            let color, radio;
            
            if (porcentajeInfectado === 0) {
                color = '#4CAF50';
                radio = 6;
            } else if (porcentajeInfectado < 10) {
                color = '#FFC107';
                radio = 8;
            } else if (porcentajeInfectado < 30) {
                color = '#FF9800';
                radio = 10;
            } else {
                color = '#F44336';
                radio = 12;
            }
            
            const marker = L.circleMarker(
                [region.coordenadas.latitud, region.coordenadas.longitud],
                {
                    radius: radio,
                    fillColor: color,
                    color: enCuarentena ? '#673AB7' : (tieneReinfecciones ? '#9C27B0' : '#000'),
                    weight: enCuarentena ? 3 : (tieneReinfecciones ? 2 : 1),
                    opacity: 1,
                    fillOpacity: 0.7
                }
            ).addTo(this.mapaAnalisis);
            
            let tooltip = `<strong>${region.nombre}</strong><br>`;
            tooltip += `🤒 Infectados: ${porcentajeInfectado.toFixed(1)}%<br>`;
            if (tieneReinfecciones) tooltip += `🔄 Reinfecciones: ${region.estadoPoblacion.reinfectados.toLocaleString()}<br>`;
            if (enCuarentena) tooltip += `🔒 EN CUARENTENA<br>`;
            tooltip += `📅 Predicción a 30 días`;
            
            marker.bindTooltip(tooltip);
        });
        
        document.getElementById('infoAnalisis').innerHTML = 
            `<p>Mapa de predicción a 30 días. Colores indican porcentaje de población infectada. 
            🔒 Indica cuarentena, 🟣 indica reinfecciones.</p>`;
    }

    identificarRegionesRiesgo() {
        const regionesLibres = this.mundo.regiones.filter(p => p.estadoPoblacion.infectada === 0);
        const regionesInfectadas = this.mundo.regiones.filter(p => p.estadoPoblacion.infectada > 0);
        
        let regionesRiesgo = [];
        let regionesRiesgoReinfeccion = [];
        
        regionesLibres.forEach(regionLibre => {
            let riesgo = 0;
            let riesgoReinfeccion = 0;
            
            regionesInfectadas.forEach(regionInfectada => {
                const clave = `${Math.min(regionInfectada.id, regionLibre.id)}-${Math.max(regionInfectada.id, regionLibre.id)}`;
                const ruta = this.mundo.tablaRutas.get(clave);
                if (ruta && ruta.activa && !ruta.cortada) {
                    riesgo += ruta.calcularProbabilidadBase() * 
                             (regionInfectada.estadoPoblacion.infectada / regionInfectada.estadoPoblacion.total);
                    
                    if (regionLibre.estadoPoblacion.recuperada > 0) {
                        riesgoReinfeccion += ruta.calcularProbabilidadBase() * 0.3 * 
                                          (regionInfectada.estadoPoblacion.infectada / regionInfectada.estadoPoblacion.total);
                    }
                }
            });
            
            if (riesgo > 0.05) {
                regionesRiesgo.push({ region: regionLibre, riesgo: riesgo, tipo: 'primera' });
            }
            
            if (riesgoReinfeccion > 0.02 && regionLibre.estadoPoblacion.recuperada > 0) {
                regionesRiesgoReinfeccion.push({ region: regionLibre, riesgo: riesgoReinfeccion, tipo: 'reinfeccion' });
            }
        });
        
        regionesRiesgo.sort((a, b) => b.riesgo - a.riesgo);
        regionesRiesgoReinfeccion.sort((a, b) => b.riesgo - a.riesgo);
        
        let resultadoHTML = `<h4>⚠️ Regiones en Riesgo de Contagio:</h4>`;
        
        if (regionesRiesgo.length === 0 && regionesRiesgoReinfeccion.length === 0) {
            resultadoHTML += `<p>No se identificaron regiones en riesgo alto.</p>`;
        } else {
            if (regionesRiesgo.length > 0) {
                resultadoHTML += `<h5>Primera Infección:</h5><ol>`;
                regionesRiesgo.slice(0, 5).forEach(item => {
                    resultadoHTML += `<li>${item.region.nombre}: Riesgo ${(item.riesgo * 100).toFixed(1)}%</li>`;
                });
                resultadoHTML += `</ol>`;
            }
            
            if (regionesRiesgoReinfeccion.length > 0) {
                resultadoHTML += `<h5>Reinfección:</h5><ol>`;
                regionesRiesgoReinfeccion.slice(0, 3).forEach(item => {
                    resultadoHTML += `<li>${item.region.nombre}: Riesgo ${(item.riesgo * 100).toFixed(1)}% (${item.region.estadoPoblacion.recuperada.toLocaleString()} recuperados)</li>`;
                });
                resultadoHTML += `</ol>`;
            }
        }
        
        document.getElementById('resultadosAnalisis').innerHTML = resultadoHTML;
        
        this.dibujarRegionesRiesgoEnMapa([...regionesRiesgo, ...regionesRiesgoReinfeccion]);
        this.mostrarMensaje(`⚠️ ${regionesRiesgo.length} regiones en riesgo de primera infección, ${regionesRiesgoReinfeccion.length} en riesgo de reinfección`);
    }

    dibujarRegionesRiesgoEnMapa(regionesRiesgo) {
        if (!this.mapaAnalisis || regionesRiesgo.length === 0) return;
        
        this.mapaAnalisis.eachLayer(layer => {
            if (!layer._url) {
                this.mapaAnalisis.removeLayer(layer);
            }
        });
        
        const minLat = Math.min(...this.mundo.regiones.map(p => p.coordenadas.latitud));
        const maxLat = Math.max(...this.mundo.regiones.map(p => p.coordenadas.latitud));
        const minLng = Math.min(...this.mundo.regiones.map(p => p.coordenadas.longitud));
        const maxLng = Math.max(...this.mundo.regiones.map(p => p.coordenadas.longitud));
        
        const margen = 0.15;
        const rangoLat = maxLat - minLat;
        const rangoLng = maxLng - minLng;
        
        const minLatConMargen = minLat - (rangoLat * margen);
        const maxLatConMargen = maxLat + (rangoLat * margen);
        const minLngConMargen = minLng - (rangoLng * margen);
        const maxLngConMargen = maxLng + (rangoLng * margen);
        
        const escalaX = this.mapaAnalisis.getSize().x / (maxLngConMargen - minLngConMargen);
        const escalaY = this.mapaAnalisis.getSize().y / (maxLatConMargen - minLatConMargen);
        
        regionesRiesgo.forEach(item => {
            const region = item.region;
            const x = (region.coordenadas.longitud - minLngConMargen) * escalaX;
            const y = this.mapaAnalisis.getSize().y - ((region.coordenadas.latitud - minLatConMargen) * escalaY);
            
            const radio = Math.max(8, 6 + Math.log10(region.estadoPoblacion.total / 1000000) * 2.5);
            const intensidad = Math.min(255, Math.floor(item.riesgo * 255 * 4));
            
            let fillColor, color;
            if (item.tipo === 'reinfeccion') {
                fillColor = `rgb(200, ${255 - intensidad}, 200)`;
                color = '#9C27B0';
            } else {
                fillColor = `rgb(255, ${255 - intensidad}, 0)`;
                color = '#FF9800';
            }
            
            const marker = L.circleMarker(
                [region.coordenadas.latitud, region.coordenadas.longitud],
                {
                    radius: radio,
                    fillColor: fillColor,
                    color: color,
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.7
                }
            ).addTo(this.mapaAnalisis);
            
            marker.bindTooltip(`
                <strong>${region.nombre}</strong><br>
                Riesgo: ${(item.riesgo * 100).toFixed(1)}%<br>
                Tipo: ${item.tipo === 'reinfeccion' ? 'Reinfección' : 'Primera Infección'}
            `);
        });
        
        document.getElementById('infoAnalisis').innerHTML = 
            '<p>Regiones en riesgo identificadas. 🟠 Naranja: primera infección. 🟣 Púrpura: reinfección.</p>';
    }

    identificarRutasCriticas() {
        const rutasConImportancia = [];
        
        this.mundo.rutas.forEach(ruta => {
            const regionOrigen = this.mundo.obtenerRegionPorId(ruta.idOrigen);
            const regionDestino = this.mundo.obtenerRegionPorId(ruta.idDestino);
            
            if (!regionOrigen || !regionDestino) return;
            
            let importancia = ruta.trafico;
            importancia *= ruta.calcularProbabilidadBase();
            
            if (regionOrigen.estadoPoblacion.infectada > 0) {
                importancia *= 1 + (regionOrigen.estadoPoblacion.infectada / regionOrigen.estadoPoblacion.total);
            }
            
            let importanciaReinfeccion = importancia * 0.3;
            
            rutasConImportancia.push({
                ruta: ruta,
                importancia: importancia,
                importanciaReinfeccion: importanciaReinfeccion,
                descripcion: `${regionOrigen.nombre} → ${regionDestino.nombre} (${ruta.tipo})`,
                cortada: ruta.cortada
            });
        });
        
        rutasConImportancia.sort((a, b) => b.importancia - a.importancia);
        
        let resultadoHTML = `<h4>🛣️ Rutas de Expansión Críticas:</h4>`;
        
        if (rutasConImportancia.length === 0) {
            resultadoHTML += `<p>No hay rutas activas.</p>`;
        } else {
            resultadoHTML += `<h5>Primera Infección:</h5><ol>`;
            rutasConImportancia
                .filter(r => !r.cortada)
                .slice(0, 5)
                .forEach(item => {
                    const porcentaje = (item.importancia * 100).toFixed(1);
                    resultadoHTML += `<li>${item.descripcion}: Importancia ${porcentaje}%</li>`;
                });
            resultadoHTML += `</ol>`;
            
            const rutasReinfeccion = rutasConImportancia
                .filter(r => r.importanciaReinfeccion > 0.1 && !r.cortada)
                .sort((a, b) => b.importanciaReinfeccion - a.importanciaReinfeccion)
                .slice(0, 3);
            
            if (rutasReinfeccion.length > 0) {
                resultadoHTML += `<h5>Reinfección:</h5><ol>`;
                rutasReinfeccion.forEach(item => {
                    const porcentaje = (item.importanciaReinfeccion * 100).toFixed(1);
                    resultadoHTML += `<li>${item.descripcion}: Importancia ${porcentaje}%</li>`;
                });
                resultadoHTML += `</ol>`;
            }
            
            const rutasCortadasCriticas = rutasConImportancia
                .filter(r => r.cortada && r.importancia > 0.2)
                .slice(0, 3);
            
            if (rutasCortadasCriticas.length > 0) {
                resultadoHTML += `<h5>🔒 Rutas Críticas Cortadas:</h5><ol>`;
                rutasCortadasCriticas.forEach(item => {
                    const porcentaje = (item.importancia * 100).toFixed(1);
                    resultadoHTML += `<li>${item.descripcion}: Importancia ${porcentaje}% (CORTADA)</li>`;
                });
                resultadoHTML += `</ol>`;
            }
        }
        
        document.getElementById('resultadosAnalisis').innerHTML = resultadoHTML;
        this.mostrarMensaje('🛣️ Rutas críticas identificadas (incluye rutas de reinfección)');
    }

    filtrarRutasAereas() {
        if (!this.mapaAnalisis) return;
        
        this.mapaAnalisis.eachLayer(layer => {
            if (!layer._url) {
                this.mapaAnalisis.removeLayer(layer);
            }
        });
        
        const minLat = Math.min(...this.mundo.regiones.map(p => p.coordenadas.latitud));
        const maxLat = Math.max(...this.mundo.regiones.map(p => p.coordenadas.latitud));
        const minLng = Math.min(...this.mundo.regiones.map(p => p.coordenadas.longitud));
        const maxLng = Math.max(...this.mundo.regiones.map(p => p.coordenadas.longitud));
        
        const margen = 0.15;
        const rangoLat = maxLat - minLat;
        const rangoLng = maxLng - minLng;
        
        const minLatConMargen = minLat - (rangoLat * margen);
        const maxLatConMargen = maxLat + (rangoLat * margen);
        const minLngConMargen = minLng - (rangoLng * margen);
        const maxLngConMargen = maxLng + (rangoLng * margen);
        
        const escalaX = this.mapaAnalisis.getSize().x / (maxLngConMargen - minLngConMargen);
        const escalaY = this.mapaAnalisis.getSize().y / (maxLatConMargen - minLatConMargen);
        
        const rutasAereas = this.mundo.rutas.filter(r => r.tipo === 'AEREO' && r.activa);
        
        rutasAereas.forEach(ruta => {
            const origen = this.mundo.obtenerRegionPorId(ruta.idOrigen);
            const destino = this.mundo.obtenerRegionPorId(ruta.idDestino);
            
            if (origen && destino) {
                const latlngs = [
                    [origen.coordenadas.latitud, origen.coordenadas.longitud],
                    [destino.coordenadas.latitud, destino.coordenadas.longitud]
                ];
                
                const color = ruta.cortada ? 'rgba(128, 128, 128, 0.3)' : 'rgba(255, 0, 0, 0.7)';
                const dashArray = ruta.cortada ? '5, 10' : null;
                
                const polyline = L.polyline(latlngs, {
                    color: color,
                    weight: ruta.cortada ? 2 : 3,
                    opacity: ruta.cortada ? 0.3 : 0.7,
                    dashArray: dashArray
                }).addTo(this.mapaAnalisis);
                
                const estado = ruta.cortada ? '🔒 CORTADA' : '✅ ACTIVA';
                polyline.bindTooltip(`
                    <strong>✈️ ${origen.nombre} ↔ ${destino.nombre}</strong><br>
                    Estado: ${estado}<br>
                    Distancia: ${Math.round(ruta.distancia)} km
                `);
            }
        });
        
        this.mundo.regiones.forEach(region => {
            const marker = L.circleMarker(
                [region.coordenadas.latitud, region.coordenadas.longitud],
                {
                    radius: 6,
                    fillColor: region.getColorEstado(),
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.7
                }
            ).addTo(this.mapaAnalisis);
            
            const tieneRutaAerea = rutasAereas.some(r => 
                r.idOrigen === region.id || r.idDestino === region.id
            );
            
            if (tieneRutaAerea) {
                marker.bindTooltip(`
                    <strong>${region.nombre}</strong><br>
                    ✈️ Tiene rutas aéreas<br>
                    ${region.enCuarentena ? '🔒 En cuarentena' : ''}
                `);
            }
        });
        
        document.getElementById('resultadosAnalisis').innerHTML = 
            `<h4>✈️ Filtro Aplicado</h4><p>Mostrando ${rutasAereas.length} rutas aéreas activas.</p>`;
        
        document.getElementById('infoAnalisis').innerHTML = 
            `<p>Mapa filtrado: solo rutas aéreas. ${rutasAereas.length} conexiones activas. 
            🔒 Indica rutas cortadas, 🔴 indica regiones infectadas.</p>`;
        
        this.mostrarMensaje('✈️ Filtro de rutas aéreas aplicado');
    }

    mostrarMensaje(mensaje, esError = false) {
        console.log(esError ? '❌ ' + mensaje : '✅ ' + mensaje);
        
        const estado = document.getElementById('estadoSimulacion');
        if (estado) {
            const estadoOriginal = estado.textContent;
            estado.textContent = esError ? `Error: ${mensaje}` : `Info: ${mensaje}`;
            estado.style.color = esError ? '#e74c3c' : '#27ae60';
            
            setTimeout(() => {
                estado.textContent = estadoOriginal;
                estado.style.color = '';
            }, 3000);
        }
        
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion ${esError ? 'error' : 'exito'}`;
        notificacion.innerHTML = `
            <div class="notificacion-contenido">
                <span class="notificacion-icono">${esError ? '❌' : '✅'}</span>
                <span class="notificacion-texto">${mensaje}</span>
            </div>
        `;
        
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${esError ? '#e74c3c' : '#27ae60'};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            notificacion.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notificacion.parentNode) {
                    notificacion.parentNode.removeChild(notificacion);
                }
            }, 300);
        }, 3000);
    }
}

// ================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ================================

let controlador;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado - Iniciando aplicación...");
    
    controlador = new ControladorAplicacion();
    window.controlador = controlador;
    
    console.log("Aplicación iniciada correctamente");
});

window.confirmarTipoRuta = function() {
    if (controlador) controlador.confirmarTipoRuta();
    else console.error("Controlador no inicializado");
};

window.cerrarModalTipoRuta = function() {
    if (controlador) controlador.cerrarModalTipoRuta();
    else console.error("Controlador no inicializado");
};

// Añadir estilos CSS para las notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notificacion {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
    }
    
    .notificacion-contenido {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notificacion-icono {
        font-size: 18px;
    }
    
    .notificacion-texto {
        flex: 1;
    }
    
    .notificacion.exito {
        background: linear-gradient(135deg, #27ae60, #2ecc71);
    }
    
    .notificacion.error {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
    }
    
    .context-menu-flotante {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .context-btn {
        display: block;
        width: 100%;
        padding: 8px 12px;
        margin: 5px 0;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
    }
    
    .context-btn:hover {
        background: #e9ecef;
        transform: translateY(-1px);
    }
    
    .context-btn.active {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
    }
    
    .context-btn.reinfeccion-btn {
        background: #f3e5f5;
        border-color: #e1bee7;
        color: #4a148c;
    }
    
    .custom-region-marker {
        background: transparent !important;
        border: none !important;
    }
    
    .region-marker {
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s;
    }
    
    .region-marker:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    }
    
    .region-marker.cuarentena {
        animation: pulse-cuarentena 2s infinite;
    }
    
    @keyframes pulse-cuarentena {
        0% { box-shadow: 0 0 0 0 rgba(103, 58, 183, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(103, 58, 183, 0); }
        100% { box-shadow: 0 0 0 0 rgba(103, 58, 183, 0); }
    }
    
    .marker-text {
        font-size: 14px;
        font-weight: bold;
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    }
    
    .ruta-info-modal {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .ruta-details {
        margin: 15px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 5px;
    }
    
    .ruta-details p {
        margin: 8px 0;
    }
    
    .ruta-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }
    
    .btn-warning {
        background: #ffc107;
        color: #212529;
    }
    
    .btn-warning:hover {
        background: #e0a800;
    }
`;
document.head.appendChild(style);
