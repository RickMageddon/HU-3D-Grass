import { Card } from "../../ui/card";
import type { StatCardProps } from "../types/robotArmProps";

export default function StatsCard({ icon, color, title, value }: StatCardProps) {
    return (
        <Card className="p-6 w-full">
            <div className="flex items-center gap-4">
                <div className={`p-3 ${color} rounded-lg`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm text-slate-600">{title}</p>
                    <p className="text-2xl text-slate-900">{value}</p>
                </div>
            </div>
        </Card>
    );
}