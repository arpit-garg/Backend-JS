class apiError extends Error{
    constructor(statusCode,message = "Something Went wrong",errors=[]){
        super(message)
        this.statusCode = statusCode
        this.errors = errors
    }
}