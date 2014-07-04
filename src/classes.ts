

class Message {
    constructor(public timestamp: number, public message: string, public from: Person, public attachments:any) { }
}
class Thread {
    public count: number;
    public id: string;
    public messages: Message[] = [];
    public people: Person[] = [];
    constructor(inputobj: { num_messages: string; thread_id: string; participants: any[] }) {
        this.count = parseInt(inputobj.num_messages || "0", 10);
        this.people = [];
        this.id = inputobj.thread_id;
        for (var i = 0; i < inputobj.participants.length; i++) {
            var p = new Person(inputobj.participants[i]);
            if (p.id == user.userID)
                continue;
            this.people.push(p);
        }
    }
}
class Person {
    id: string;
    name: string;
    constructor(inputobj: { user_id?: string; name?: string }) {
        this.id = inputobj.user_id || "0";
        this.name = (typeof inputobj.name == "undefined") ? "Andere" : inputobj.name;
    }
}