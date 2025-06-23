import { useEffect, useState } from "react";
import { useMediaDeviceSelect } from "@livekit/components-react";
import { ChevronDown } from "lucide-react";

type DeviceSelectorProps = {
  kind: MediaDeviceKind;
};

export const DeviceSelector = ({ kind }: DeviceSelectorProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const deviceSelect = useMediaDeviceSelect({ kind: kind });
  const [selectedDeviceName, setSelectedDeviceName] = useState("");

  useEffect(() => {
    deviceSelect.devices.forEach((device) => {
      if (device.deviceId === deviceSelect.activeDeviceId) {
        setSelectedDeviceName(device.label);
      }
    });
  }, [deviceSelect.activeDeviceId, deviceSelect.devices]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) {
        setShowMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showMenu]);



  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-tertiary/50 transition-all duration-100`}
        onClick={(e) => {
          setShowMenu(!showMenu);
          e.stopPropagation();
        }}
      >
        <span className="text-xs text-text-primary truncate max-w-[120px]">
          {selectedDeviceName || "Select device"}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-secondary flex-shrink-0 transition-transform duration-100 ${showMenu ? "rotate-180" : "rotate-0"}`} />
      </button>
      <div
        className="absolute bg-bg-secondary right-0 top-auto bottom-8 text-text-primary text-left border border-border-DEFAULT box-border rounded-md z-10 w-[280px] shadow-md"
        style={{
          display: showMenu ? "block" : "none"
        }}
      >
        {deviceSelect.devices.map((device, index) => {
          const isFirst = index === 0;
          const isLast = index === deviceSelect.devices.length - 1;

          let roundedStyles = "";
          if (isFirst) {
            roundedStyles = " rounded-t-[5px]";
          } else if (isLast) {
            roundedStyles = " rounded-b-[5px]";
          }

          return (
            <div
              onClick={(e) => {
                e.stopPropagation();
                deviceSelect.setActiveMediaDevice(device.deviceId);
                setShowMenu(false);
              }}
              className={`${device.deviceId === deviceSelect.activeDeviceId
                ? "bg-bg-tertiary font-medium"
                : ""
                } text-text-primary text-xs py-2 px-2 cursor-pointer hover:bg-bg-tertiary ${roundedStyles}`}
              key={device.deviceId}
            >
              {device.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
