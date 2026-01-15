document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if(!clienteId) return alert("Seleccione un cliente");
  if(carrito.length===0) return alert("Carrito vacío");

  const diasConsignacion = Number(diasConsignacionInput.value || 0);
  const fechaVencimiento = diasConsignacion > 0 ? new Date(Date.now() + diasConsignacion*24*60*60*1000) : null;

  const clienteDoc = await getDoc(doc(db,"clientes",clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s,l)=>s+l.subtotal,0);

  // Registrar la venta en Firestore
  const ventaRef = await addDoc(collection(db,"ventas"),{
    vendedorId,
    cliente:{id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion>0 ? { dias:diasConsignacion, vencimiento: fechaVencimiento, estado:"pendiente de pago" } : null,
    comentario: ""
  });

  // Crear objeto venta para generar el ticket
  const ventaData = {
    id: ventaRef.id,
    vendedorId,
    cliente:{id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion>0 ? { dias:diasConsignacion, vencimiento: fechaVencimiento, estado:"pendiente de pago" } : null,
    comentario: ""
  };

  // Limpiar carrito y UI
  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  clienteSelect.disabled = false;
  diasConsignacionInput.value = "";
  alert("Pedido registrado");

  cargarPedidos();

  // 🔹 Generar ticket
  generarTicket(ventaData);
};
