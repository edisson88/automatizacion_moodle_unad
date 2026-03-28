// ==UserScript==
// @name         [UNAD] AUTOMATIZACIÓN SAI ABIERTO 1604 2025
// @namespace    http://tampermonkey.net/
// @version      2025-04-29
// @description  Muestra un botón flotante para aplicar la automatización al formulario SAI.
// @author       JHON FREDY GONZÁLEZ ECBTI CIP DOSQUEBRADAS <jhon.gonzalez@unad.edu.co>
// @match        https://aurea2.unad.edu.co/c2/saiacompanaest.php
// @icon         https://www.google.com/s2/favicons?sz=64&domain=edu.co
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // === FUNCIÓN PARA SELECCIONAR OPCIÓN POR TEXTO VISIBLE EN SELECT ===
  function seleccionarOpcionReal(idSelect, textoVisible) {
    const select = document.getElementById(idSelect);
    if (!select) {
      console.error(`❌ No se encontró el <select> con id: ${idSelect}`);
      return;
    }

    let found = false;
    for (let opt of select.options) {
      if (opt.text.trim().toLowerCase() === textoVisible.trim().toLowerCase()) {
        select.value = opt.value;
        found = true;
        break;
      }
    }

    if (found) {
      // Disparar evento change
      select.dispatchEvent(new Event('change', { bubbles: true }));

      // Si usa Chosen, actualizarlo
      $(`#${idSelect}`).trigger("chosen:updated");

      console.log(`✅ Seleccionado en ${idSelect}: ${textoVisible}`);
    } else {
      console.warn(`⚠️ Opción no encontrada: ${textoVisible} en ${idSelect}`);
    }
  }

  // === FUNCIÓN QUE EJECUTA LA AUTOMATIZACIÓN ===
  function ejecutarAutomatizacion() {
    console.log("🚀 Iniciando automatización...");

    // Selecciones automáticas
    seleccionarOpcionReal("saiu41motivocontacto", "No entregó la actividad");
    seleccionarOpcionReal("saiu41contacto_forma", "Curso virtual (foros, mensajería interna)");
    seleccionarOpcionReal("saiu41acciones", "Mediación en tiempo para la entrega de actividades académicas");
    seleccionarOpcionReal("saiu41resultados", "No responde");

    // Observación automática
    const campoObs = document.getElementById("saiu41contacto_observa");
    if (campoObs) {
      campoObs.value =
        "Para la tarea 2, se llevó a cabo un acompañamiento constante. Tras el cierre inicial 09 MARZO, se extendió el plazo una semana adicional hasta el 15 MARZO, además, se le llamó al telefono registrado, SE LE DEJÓ MENSAJE DE WHATSAPP . Durante todo el proceso, se enviaron mensajes por diferentes medios, incluido mensaje de texto, aunque no se obtuvo respuesta.";
      campoObs.dispatchEvent(new Event('input', { bubbles: true }));
      console.log("✅ Observación insertada correctamente.");
    } else {
      console.error("❌ No se encontró el campo de observaciones.");
    }

    // Hacer clic en el botón de guardar
    const botonGuardar = document.querySelector("#botones_sector1 button:nth-child(3) i svg path");
    if (botonGuardar) {
      const buttonElement = botonGuardar.closest('button');
      if (buttonElement) {
        buttonElement.click();
        console.log("✅ Botón de guardar clicado.");
      }
    } else {
      console.error("❌ No se encontró el botón de guardar.");
    }

    // Esperar un momento para que la página procese la acción de guardar
    setTimeout(() => {
      // Hacer clic en el botón de cerrar
      const botonCerrar = document.querySelector("#botones_sector1 button:nth-child(5) i svg path");
      if (botonCerrar) {
        const buttonElement = botonCerrar.closest('button');
        if (buttonElement) {
          buttonElement.click();
          console.log("✅ Botón de cerrar clicado.");
        }
      } else {
        console.warn("❌ No se encontró el botón de cerrar (opcional).");
      }

      // Esperar antes de hacer clic en aceptar
      setTimeout(() => {
        // Hacer clic en el botón de aceptar si aparece
        const botonAceptar = document.getElementById("boton__aceptar__title");
        if (botonAceptar) {
          botonAceptar.click();
          console.log("✅ Botón de aceptar clicado.");
        } else {
          console.warn("❌ No se encontró el botón de aceptar (opcional).");
        }

        // === PASO ADICIONAL: CERRAR DOCUMENTO ===
        setTimeout(() => {
          // Usar XPath para encontrar el botón "Cerrar" basado en onclick="enviacerrar()"
          const botonCerrarDocumento = document.evaluate(
            '//button[@onclick="enviacerrar()"]',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;

          if (botonCerrarDocumento) {
            const buttonElement = botonCerrarDocumento.closest('button');
            if (buttonElement) {
              buttonElement.click();
              console.log("✅ Botón de cerrar documento clicado.");

              // Esperar hasta que aparezca el cuadro de advertencia
              const intervaloEspera = setInterval(() => {
                const advertencia = document.querySelector('.ui-dialog-content'); // Selector genérico para el cuadro de advertencia
                if (advertencia) {
                  clearInterval(intervaloEspera);

                  // Hacer clic en el botón "Aceptar" del cuadro de advertencia
                  const botonAceptarFinal = document.getElementById("boton__aceptar__title");
                  if (botonAceptarFinal) {
                    botonAceptarFinal.click();
                    console.log("✅ Botón de aceptar en el cuadro de advertencia clicado.");
                  } else {
                    console.warn("❌ No se encontró el botón de aceptar en el cuadro de advertencia.");
                  }
                }
              }, 100); // Revisar cada 100ms
            }
          } else {
            console.warn("❌ No se encontró el botón de cerrar documento.");
          }
        }, 1000); // 1 segundo después de aceptar
      }, 2000); // 2 segundos después de cerrar
    }, 2000); // 2 segundos después de guardar
  }

  // === CREAR BOTÓN FLOTANTE ===
  function crearBotonFlotante() {
    const button = document.createElement("button");
    button.textContent = "🚀 Aplicar Automatización SAI";
    button.style.position = "fixed";
    button.style.top = "40px";
    button.style.right = "80px";
    button.style.zIndex = "999999";
    button.style.padding = "15px 30px";
    button.style.background = "#4CAF50";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "8px";
    button.style.fontSize = "16px";
    button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
    button.style.cursor = "pointer";

    button.addEventListener("click", () => {
      console.log("🖱️ Botón clickeado. Ejecutando automatización...");
      ejecutarAutomatizacion();
    });

    // Asegurar que se agregue al DOM cuando esté listo
    const forceInterval = setInterval(() => {
      if (document.body) {
        document.body.appendChild(button);
        clearInterval(forceInterval);
        console.log("✅ Botón flotante creado exitosamente.");
      }
    }, 100);
  }

  // === EJECUCIÓN PRINCIPAL ===
  crearBotonFlotante();
})();