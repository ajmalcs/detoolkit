export default function Welcome() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-4xl font-bold mb-4">Welcome to DEtools</h1>
            <p className="text-xl text-muted-foreground mb-8">
                Private, Client-Side Utilities for Data Engineers.
            </p>
            <div className="p-4 border rounded-lg bg-card text-card-foreground">
                <p>100% Client-Side / Private</p>
            </div>
        </div>
    )
}
